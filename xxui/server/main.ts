import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { pool, one } from './db';
import { makeAuth } from './auth';
import { buildApp } from './app';
import { processRun } from './workflow';
if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET)
  throw new Error('请配置 DATABASE_URL 与 BETTER_AUTH_SECRET');
const auth = makeAuth(),
  bootstrap = makeAuth(true);
const app = await buildApp(pool, auth, {
  storage: process.env.MATERIALS_DIR ?? 'work/materials',
  origins: (process.env.WEB_ORIGINS ?? 'http://localhost:5173').split(','),
  createAccount: async (v) => {
    const existing = await one(pool, 'SELECT id FROM "user" WHERE email=$1', [
      v.email,
    ]);
    return existing
      ? bootstrap.api.signInEmail({
          body: { email: v.email, password: v.password },
        })
      : bootstrap.api.signUpEmail({ body: v });
  },
});
const lock = await pool.connect();
const acquired = await lock.query(
  'SELECT pg_try_advisory_lock(724102) AS acquired',
);
if (!acquired.rows[0].acquired)
  throw new Error('执行服务已在运行；本版只启动一个 worker 实例');
const saver = new PostgresSaver(pool);
await saver.setup();
await pool.query(
  "UPDATE runs SET status='failed',error='执行服务重启，任务被中断；请明确重试',updated_at=now() WHERE status IN ('extracting','analyzing','evidence','planning','reviewing') OR (status='queued' AND claimed_at IS NOT NULL)",
);
const active = new Map<string, AbortController>();
let stopping = false,
  claiming = false;
const ticker = setInterval(async () => {
  if (stopping || claiming) return;
  claiming = true;
  try {
    for (const [id, c] of active) {
      const r = await one(
        pool,
        'SELECT cancel_requested FROM runs WHERE id=$1',
        [id],
      );
      if (r?.cancel_requested) c.abort();
    }
    while (active.size < 2) {
      const run = await one(
        pool,
        "UPDATE runs SET claimed_at=now() WHERE id=(SELECT id FROM runs WHERE status='queued' AND claimed_at IS NULL AND NOT cancel_requested ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
      );
      if (!run) break;
      const controller = new AbortController();
      active.set(run.id, controller);
      processRun(pool, run, saver, controller.signal)
        .catch(async (e) => {
          await pool.query(
            "UPDATE runs SET status='failed',error=$1,updated_at=now() WHERE id=$2 AND NOT cancel_requested",
            [e instanceof Error ? e.message : '执行失败', run.id],
          );
        })
        .finally(() => active.delete(run.id));
    }
  } catch (e) {
    app.log.error(e, 'worker error');
  } finally {
    claiming = false;
  }
}, 500);
await app.listen({
  port: Number(process.env.PORT ?? 4100),
  host: process.env.HOST ?? '127.0.0.1',
});
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(ticker);
  active.forEach((c) => c.abort());
  await app.close();
  while (active.size) await new Promise((r) => setTimeout(r, 100));
  lock.release();
  await pool.end();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
