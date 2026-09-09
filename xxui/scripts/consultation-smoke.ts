import { pool, one } from '../server/db';
import { processRun } from '../server/workflow';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { readFile, writeFile } from 'node:fs/promises';
const a = JSON.parse(await readFile('work/local-accounts.json', 'utf8'));
const id = crypto.randomUUID();
await pool.query(
  "INSERT INTO runs(id,project_id,world_version,type,status,input,created_by) VALUES($1,$2,0,'consultation','waiting_verification',$3,$4)",
  [
    id,
    a.project_id,
    JSON.stringify({
      instruction:
        '根据本项目已有材料，村庄适老化助餐路线应该核查哪些方面？请区分项目方法与已核验规范。',
    }),
    a.users[0].id,
  ],
);
const start = Date.now();
try {
  await processRun(
    pool,
    await one(pool, 'SELECT * FROM runs WHERE id=$1', [id]),
    new PostgresSaver(pool),
    new AbortController().signal,
  );
  const r = await one(pool, 'SELECT status,result FROM runs WHERE id=$1', [id]);
  const report = { id, elapsed_ms: Date.now() - start, ...r };
  await writeFile(
    'work/consultation-report.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  await pool.query("UPDATE runs SET status='failed',error=$1 WHERE id=$2", [
    String(e),
    id,
  ]);
  console.log(String(e));
  process.exitCode = 1;
} finally {
  await pool.end();
}
