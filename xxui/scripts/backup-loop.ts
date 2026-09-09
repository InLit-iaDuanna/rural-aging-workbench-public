import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const root = process.env.BACKUP_DIR ?? '/backups';
await mkdir(root, { recursive: true, mode: 0o700 });
async function backup() {
  const directory = root + '/' + new Date().toISOString().replaceAll(':', '-');
  await new Promise<void>((resolve, reject) => {
    const p = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/backup.ts', 'backup', directory],
      { stdio: 'inherit' },
    );
    p.on('error', reject);
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('每日备份失败')),
    );
  });
}
await backup();
setInterval(
  () =>
    backup().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    }),
  24 * 60 * 60 * 1000,
);
