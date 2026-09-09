import { it, expect } from 'vitest';
import { runProcess } from '../server/cli';
import { tmpdir } from 'node:os';
it('terminates on timeout and cancellation', async () => {
  await expect(
    runProcess(process.execPath, ['-e', 'setInterval(()=>{},100)'], '', {
      cwd: tmpdir(),
      timeout: 30,
    }),
  ).rejects.toThrow('超时');
  const c = new AbortController();
  const p = runProcess(
    process.execPath,
    ['-e', 'setInterval(()=>{},100)'],
    '',
    { cwd: tmpdir(), signal: c.signal },
  );
  setTimeout(() => c.abort(), 30);
  await expect(p).rejects.toThrow('取消');
});
it('passes untrusted text as stdin rather than shell code', async () => {
  const text = '$(touch /tmp/should-never-exist) `whoami`';
  expect(
    await runProcess(
      process.execPath,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      text,
      { cwd: tmpdir() },
    ),
  ).toBe(text);
});
