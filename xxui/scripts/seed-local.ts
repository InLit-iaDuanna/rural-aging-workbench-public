import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { makeAuth } from '../server/auth';
import { pool } from '../server/db';
import { demoSpatial } from '../lib/spatial';
import { exampleScenarios } from '../lib/v2/simulation';
import { saveRecord } from '../server/store';
const auth = makeAuth(true);
await auth.$context;
const users = [];
for (const role of ['manager', 'reviewer', 'recorder', 'analyst']) {
  const email = `${role}@xiangzhu.test`,
    password = randomUUID();
  const account = await auth.api.signUpEmail({
    body: { email, password, name: `本机测试 ${role}` },
  });
  users.push({ id: account.user.id, email, password, role });
}
const projectId = randomUUID(),
  world = demoSpatial();
world.roads = world.roads.map((r) => ({ ...r, confirmed: true }));
await pool.query(
  "INSERT INTO projects(id,name,mode,spatial) VALUES($1,'青溪村 · 合成联调示例','demo',$2)",
  [projectId, JSON.stringify(world)],
);
for (const u of users)
  await pool.query('INSERT INTO members VALUES($1,$2,$3)', [
    projectId,
    u.id,
    u.role,
  ]);
await pool.query('INSERT INTO world_versions VALUES($1,0,$2,$3,$4,now())', [
  projectId,
  JSON.stringify(world),
  '合成联调',
  users[0].id,
]);
for (const sc of exampleScenarios(world))
  await saveRecord(pool, users[0].id, projectId, 'scenario', {
    base_version: 0,
    source: '合成示例',
    data: sc,
  });
await writeFile(
  'work/local-accounts.json',
  JSON.stringify({ project_id: projectId, users }, null, 2),
  { mode: 0o600 },
);
console.log(
  '本机合成项目及四种角色已创建；凭据仅保存在 work/local-accounts.json',
);
await pool.end();
