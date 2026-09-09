import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { readFile, writeFile } from 'node:fs/promises';
import { pool, one } from '../server/db';
import { saveRecord } from '../server/store';
import { processRun } from '../server/workflow';
const accounts = JSON.parse(await readFile('work/local-accounts.json', 'utf8')),
  project = accounts.project_id,
  user = accounts.users[0].id;
const f = await saveRecord(pool, user, project, 'feedback', {
  base_version: 0,
  source: '合成 AI 整链验收',
  data: {
    text: '示例村雨后助餐路线需要工作人员核查。请形成现场核查任务，不推荐工程措施。',
    location: '合成 R-01',
    road_id: 'R-01',
    consent: 'allowed',
    allow_model: true,
    confirmed: true,
    material_ids: [],
  },
});
await saveRecord(pool, user, project, 'issue', {
  base_version: 0,
  source: '合成 AI 整链验收',
  data: {
    feedback_id: f.id,
    road_id: 'R-01',
    description: '安排工作人员核查雨后通行',
    status: 'pending',
    missing_fields: [],
  },
});
const id = crypto.randomUUID();
await pool.query(
  "INSERT INTO runs(id,project_id,world_version,type,status,input,created_by) VALUES($1,$2,0,'agent','waiting_verification',$3,$4)",
  [id, project, JSON.stringify({ feedback_id: f.id }), user],
);
const run = await one(pool, 'SELECT * FROM runs WHERE id=$1', [id]);
const controller = new AbortController(),
  start = Date.now();
try {
  await processRun(pool, run, new PostgresSaver(pool), controller.signal);
  const result = await one(pool, 'SELECT status,result FROM runs WHERE id=$1', [
    id,
  ]);
  const events = (
    await pool.query(
      'SELECT stage,payload FROM run_events WHERE run_id=$1 ORDER BY id',
      [id],
    )
  ).rows;
  await writeFile(
    'work/ai-workflow-report.json',
    JSON.stringify(
      { elapsed_ms: Date.now() - start, ...result, events },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: result.status,
      elapsed_ms: Date.now() - start,
      proposal: !!result.result?.proposal,
      review: !!result.result?.review,
      stages: events.map((e) => e.stage),
    }),
  );
} catch (e) {
  await pool.query("UPDATE runs SET status='failed',error=$1 WHERE id=$2", [
    String(e),
    id,
  ]);
  console.log(
    JSON.stringify({
      status: 'failed',
      error: String(e),
      elapsed_ms: Date.now() - start,
    }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
