import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app';
import type { DB } from '../server/db';
import { world } from './fixtures';
it('protects API boundaries and atomically replays offline writes', async () => {
  const pg = new PGlite(),
    db: DB = {
      query: async (q, a) => {
        const r = await pg.query(q, a);
        return { rows: r.rows };
      },
    },
    storage = await mkdtemp(join(tmpdir(), 'xiangzhu-api-'));
  await pg.exec(
    await readFile(
      new URL('../server/migrations/001.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.query(
    "INSERT INTO projects(id,name,mode,spatial) VALUES('p','test','demo',$1)",
    [JSON.stringify(world())],
  );
  await db.query("INSERT INTO members VALUES('p','u','manager')");
  const app = await buildApp(
    db,
    {
      handler: async () => new Response(),
      api: {
        getSession: async ({ headers }) =>
          headers.get('cookie') === 'test-session'
            ? { user: { id: 'u' } }
            : null,
      },
    },
    { storage, origins: ['https://test.local'] },
  );
  const headers = { cookie: 'test-session', origin: 'https://test.local' };
  try {
    expect((await app.inject({ url: '/api/v1/projects' })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          url: '/api/v1/projects/other/records/feedback',
          headers,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/projects',
          headers: { ...headers, origin: 'https://evil.test' },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    const body = {
      request_id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      kind: 'feedback',
      input: {
        base_version: 0,
        source: 'offline test',
        data: {
          text: '合成反馈',
          location: 'a',
          road_id: 'ab',
          consent: 'allowed',
          allow_model: false,
          confirmed: false,
          material_ids: [],
        },
      },
    };
    const first = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/p/sync',
        headers,
        payload: body,
      }),
      again = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/p/sync',
        headers,
        payload: body,
      });
    expect(first.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect((await db.query('SELECT * FROM sync_receipts')).rows).toHaveLength(
      1,
    );
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/p/sync',
      headers,
      payload: { ...body, request_id: crypto.randomUUID() },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().details.current.id).toBe(body.id);
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/p/runs',
      headers,
      payload: { type: 'agent', feedback_id: body.id },
    });
    expect(denied.statusCode).toBe(422);
  } finally {
    await app.close();
    await pg.close();
    await rm(storage, { recursive: true, force: true });
  }
});
