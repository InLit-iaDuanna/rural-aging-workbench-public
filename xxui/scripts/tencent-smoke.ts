import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const accounts = JSON.parse(await readFile('work/local-accounts.json', 'utf8'));
const user = accounts.users.find((u: any) => u.role === 'manager');
const base = 'http://127.0.0.1:4100';
const auth = await fetch(base + '/api/auth/sign-in/email', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  },
  body: JSON.stringify({ email: user.email, password: user.password }),
});
assert.equal(auth.status, 200);
const cookie = auth.headers
  .getSetCookie()
  .map((s) => s.split(';')[0])
  .join('; ');
const unauthorized = await fetch(base + '/api/v1/map/geocode?address=test');
assert.equal(unauthorized.status, 401);
const r = await fetch(
  base +
    '/api/v1/map/geocode?address=' +
    encodeURIComponent('北京市海淀区中关村'),
  { headers: { cookie } },
);
const d: any = await r.json();
assert.equal(r.status, 200);
assert.equal(d.coordinate_system, 'GCJ-02');
assert.ok(d.result.location.lat > 39);
const report = {
  status: 'passed',
  authenticated_geocode: true,
  anonymous_denied: true,
  coordinate_system: d.coordinate_system,
  location: d.result.location,
  source: d.source,
};
await writeFile('work/tencent-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
