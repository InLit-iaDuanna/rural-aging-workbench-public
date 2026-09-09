import { pool } from '../server/db';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const name = 'xiangzhu_restore_v2';
await pool.query(`CREATE DATABASE ${name}`);
const url = new URL(process.env.DATABASE_URL!);
url.pathname = '/' + name;
const env = {
  ...process.env,
  DATABASE_URL: url.href,
  MATERIALS_DIR: 'work/restored-materials',
};
async function child(file: string, args: string[] = []) {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, ['--import', 'tsx', file, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    p.stdout.on('data', (d) => (output += d));
    p.stderr.on('data', (d) => (output += d));
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(output))));
    p.on('error', reject);
  });
}
await child('server/migrate.ts');
// Recreate checkpointer schema in the isolated restore database before loading rows.
const pg = await import('pg');
const target = new pg.default.Pool({ connectionString: url.href });
const { PostgresSaver } =
  await import('@langchain/langgraph-checkpoint-postgres');
await new PostgresSaver(target).setup();
await target.query('TRUNCATE checkpoint_migrations');
await child('scripts/backup.ts', ['restore', 'work/backup-v2']);
const snapshot = JSON.parse(
  await readFile('work/backup-v2/database.json', 'utf8'),
);
const counts = [];
for (const t of snapshot.tables) {
  const n = Number(
    (
      await target.query(
        'SELECT count(*) AS n FROM "' + t.name.replaceAll('"', '""') + '"',
      )
    ).rows[0].n,
  );
  if (n !== t.rows.length) throw new Error('恢复记录数不一致：' + t.name);
  counts.push({ table: t.name, rows: n });
}
await writeFile(
  'work/restore-report.json',
  JSON.stringify({ status: 'passed', tables: counts }, null, 2),
);
console.log('独立数据库恢复成功，全部表记录数一致');
await target.end();
await pool.end();
