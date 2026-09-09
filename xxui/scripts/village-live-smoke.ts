import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
const accounts = JSON.parse(await readFile('work/local-accounts.json', 'utf8'));
const a = accounts.users.find((u: any) => u.role === 'manager');
const login = await fetch(base + '/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ email: a.email, password: a.password }),
});
assert.equal(login.status, 200);
const cookie = login.headers
  .getSetCookie()
  .map((s) => s.split(';')[0])
  .join('; ');
async function request(
  path: string,
  body?: any,
  method = body ? 'POST' : 'GET',
) {
  const r = await fetch(base + path, {
    method,
    headers: { cookie, 'content-type': 'application/json', origin: base },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d: any = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
const address = '安徽省黄山市黟县宏村';
const lookup = await request(
  '/api/v1/map/geocode?address=' + encodeURIComponent(address),
);
const location = {
  name: '接口验收 · 宏村',
  address,
  location: lookup.result.location,
  coordinate_system: 'GCJ-02',
  source: '腾讯地图地址解析',
  adcode: lookup.result.ad_info?.adcode ?? '',
  notes: '自动接口测试档案，不代表已开展村庄试点',
  confirmed: true,
};
const p = await request('/api/v1/projects', {
  name: location.name,
  mode: 'reality',
  geographic_location: location,
});
const saved = await request('/api/v1/projects/' + p.id);
assert.equal(saved.geographic_location.address, address);
assert.equal(saved.spatial.roads.length, 0);
const knowledge = await request(
  '/api/v1/knowledge?q=' + encodeURIComponent('道路宽度'),
);
assert.ok(knowledge.length > 0);
const run = await request(`/api/v1/projects/${p.id}/runs`, {
  type: 'consultation',
  instruction:
    '根据已有知识，调查道路有效宽度时应记录哪些内容？不要把方案中的示例米数当作规范。',
});
const started = Date.now();
let r: any;
while (Date.now() - started < 90000) {
  r = await request(`/api/v1/projects/${p.id}/runs/${run.run_id}`);
  if (['completed', 'failed', 'cancelled'].includes(r.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
assert.equal(r.status, 'completed', r.error);
assert.ok(r.result.analysis.summary);
assert.ok(r.result.review.verdict);
assert.ok(r.result.knowledge.length);
const report = {
  status: 'passed',
  project_id: p.id,
  geocode: true,
  persisted: true,
  no_invented_roads: true,
  knowledge_matches: knowledge.length,
  ai_status: r.status,
  review: r.result.review.verdict,
  elapsed_ms: Date.now() - started,
  citations: r.result.knowledge.map((x: any) => x.id),
};
await writeFile(
  'work/village-live-report.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
