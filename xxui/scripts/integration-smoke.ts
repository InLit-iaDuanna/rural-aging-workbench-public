import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const accounts = JSON.parse(await readFile('work/local-accounts.json', 'utf8'));
const report: any[] = [];
const base = 'http://127.0.0.1:4100';
async function login(role: string) {
  const a = accounts.users.find((u: any) => u.role === role);
  const r = await fetch(base + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email: a.email, password: a.password }),
  });
  assert.equal(r.status, 200, await r.text());
  return r.headers
    .getSetCookie()
    .map((s) => s.split(';')[0])
    .join('; ');
}
const manager = await login('manager'),
  reviewer = await login('reviewer');
const path = '/api/v1/projects/' + accounts.project_id;
async function req(
  p: string,
  body?: any,
  cookie = manager,
  method = body ? 'POST' : 'GET',
) {
  const r = await fetch(base + p, {
    method,
    headers: {
      cookie,
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify({ path: p, status: r.status, data: d }));
  return d as any;
}
const data = (d: any) => ({
  base_version: 0,
  source: '本机合成端到端测试',
  data: d,
});
const f = await req(
  path + '/records/feedback',
  data({
    text: '雨后去助餐点的道路有积水',
    location: '合成示例 R-01',
    road_id: 'R-01',
    consent: 'allowed',
    allow_model: true,
    confirmed: true,
    material_ids: [],
  }),
);
const issue = await req(
  path + '/records/issue',
  data({
    feedback_id: f.id,
    road_id: 'R-01',
    description: '雨后通行需现场核实',
    status: 'pending',
    missing_fields: [],
  }),
);
const scenes = await req(path + '/records/scenario');
const r = await req(path + '/runs', {
  type: 'simulation',
  scenario_id: scenes[0].id,
  mode: 'rules',
});
let simulation;
for (let i = 0; i < 40; i++) {
  simulation = await req(path + '/runs/' + r.run_id);
  if (['completed', 'failed'].includes(simulation.status)) break;
  await new Promise((r) => setTimeout(r, 200));
}
assert.equal(simulation.status, 'completed');
report.push({
  test: 'authenticated simulation worker',
  status: 'passed',
  metrics: simulation.result.metrics,
});
const proposal = await req(
  path + '/records/proposal',
  data({
    title: '现场核查任务',
    issue_ids: [issue.id],
    scenario_id: scenes[0].id,
    evidence_ids: [],
    changes: [],
    tasks: [
      {
        title: '查明雨后有效通行宽度',
        type: 'verification',
        description: '由具备条件的工作人员核查，不要求老人通过危险路段',
      },
    ],
    missing_fields: [],
    budget: '待测算',
    status: 'draft',
    simulation_ids: [simulation.id],
  }),
);
await req(
  path + '/records/review',
  data({
    proposal_id: proposal.id,
    verdict: 'pass',
    notes: '合成核查任务，引用推演已核对',
    evidence_ids: [],
  }),
  reviewer,
);
const updated = await req(path + '/records/proposal/' + proposal.id);
const confirm = {
  base_version: updated.version,
  request_id: crypto.randomUUID(),
};
const first = await req(
    path + '/proposals/' + proposal.id + '/confirm',
    confirm,
  ),
  again = await req(path + '/proposals/' + proposal.id + '/confirm', confirm);
assert.deepEqual(first, again);
let action = await req(path + '/records/action/' + first.action_ids[0]);
for (const status of ['in_progress', 'followup'])
  action = await req(
    path + '/records/action/' + action.id,
    {
      base_version: action.version,
      source: '合成测试',
      data: { ...action.data, status },
    },
    manager,
    'PUT',
  );
await req(
  path + '/records/followup',
  data({
    action_id: action.id,
    text: '合成闭环测试，不代表现场已实施',
    result: 'resolved',
    material_ids: [],
    observed_at: new Date().toISOString(),
  }),
);
const closed = await req(path + '/records/action/' + action.id);
assert.equal(closed.data.status, 'closed');
report.push({
  test: 'feedback→issue→simulation→proposal→independent review→idempotent confirmation→action→followup',
  status: 'passed',
});
const sync = {
  request_id: crypto.randomUUID(),
  id: crypto.randomUUID(),
  kind: 'feedback',
  input: data({ ...f.data, text: '离线合成反馈' }),
};
const sync1 = await req(path + '/sync', sync),
  sync2 = await req(path + '/sync', sync);
assert.equal(sync1.id, sync2.id);
assert.equal(sync1.version, sync2.version);
report.push({ test: 'offline request replay', status: 'passed' });
const denied = await fetch(
  base + '/api/v1/projects/not-a-member/records/feedback',
  { headers: { cookie: manager } },
);
assert.equal(denied.status, 403);
report.push({ test: 'cross-project access', status: 'passed' });
await writeFile(
  'work/integration-report.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
