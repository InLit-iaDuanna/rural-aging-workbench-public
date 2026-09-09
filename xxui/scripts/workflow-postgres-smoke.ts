import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pool } from '../server/db';
import { saveRecord } from '../server/store';
import { buildWorkflow } from '../server/workflow';
const account = JSON.parse(await readFile('work/local-accounts.json', 'utf8')),
  pid = account.project_id,
  user = account.users[0].id;
const feedback = await saveRecord(pool, user, pid, 'feedback', {
  base_version: 0,
  source: '合成持久化验收',
  data: {
    text: '合成：桥头积水',
    location: '桥头',
    road_id: 'R-01',
    consent: 'allowed',
    allow_model: true,
    confirmed: false,
    material_ids: [],
  },
});
const id = crypto.randomUUID();
await pool.query(
  "INSERT INTO runs(id,project_id,world_version,type,status,input,created_by) VALUES($1,$2,0,'agent','waiting_verification','{}',$3)",
  [id, pid, user],
);
const saver = new PostgresSaver(pool),
  graph = buildWorkflow(pool, saver);
await graph.invoke(
  { run_id: id, project_id: pid, user_id: user, feedback_id: feedback.id },
  { configurable: { thread_id: id } },
);
const restarted = buildWorkflow(pool, new PostgresSaver(pool));
const state = await restarted.getState({ configurable: { thread_id: id } });
assert.ok(state.next.includes('verify'));
assert.equal(state.values.feedback_id, feedback.id);
await writeFile(
  'work/workflow-postgres-report.json',
  JSON.stringify({
    status: 'passed',
    next: state.next,
    checkpoint_persisted: true,
  }),
);
console.log('PostgreSQL 检查点跨实例恢复已验证');
await pool.end();
