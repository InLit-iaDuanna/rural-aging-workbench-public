// Local verification utility only. Production uses the PostgreSQL service in compose.yaml.
import EmbeddedPostgres from 'embedded-postgres';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
await mkdir('work', { recursive: true });
const password = randomUUID();
const pg = new EmbeddedPostgres({
  databaseDir: 'work/postgres',
  user: 'xiangzhu',
  password,
  port: 55432,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
try {
  await access('work/postgres/PG_VERSION');
  throw new Error('本地数据库已存在，请使用先前环境配置；不会覆盖已有数据');
} catch (e: any) {
  if (e.code !== 'ENOENT') throw e;
}
await pg.initialise();
await pg.start();
await pg.createDatabase('xiangzhu');
await writeFile(
  'work/local.env',
  `DATABASE_URL=postgresql://xiangzhu:${password}@127.0.0.1:55432/xiangzhu\nBETTER_AUTH_SECRET=${randomUUID() + randomUUID()}\nAUTH_URL=http://localhost:3000\nWEB_ORIGINS=http://localhost:3000\nMATERIALS_DIR=work/materials\nPORT=4100\n`,
  { mode: 0o600 },
);
console.log('本地 PostgreSQL 已启动；配置保存在 work/local.env');
process.on('SIGTERM', async () => {
  await pg.stop();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
await new Promise(() => {});
