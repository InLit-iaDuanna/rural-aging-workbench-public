import { it, expect, vi } from 'vitest';
import { processRun } from '../server/workflow';
vi.mock('../server/cli', () => ({
  execute: vi.fn(async () => ({
    image_readable: true,
    summary: '测试巡查',
    findings: [],
    missing_fields: ['待现场核查'],
  })),
}));
import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app';
it('persists real village metadata without inventing a road network and rejects concurrent location updates', async () => {
  const pg = new PGlite();
  await pg.exec(
    await readFile(
      new URL('../server/migrations/001.sql', import.meta.url),
      'utf8',
    ),
  );
  const db: any = {
    query: async (q: string, a: any[]) => {
      const r = await pg.query(q, a);
      return { rows: r.rows };
    },
  };
  const storage = await mkdtemp(join(tmpdir(), 'village-'));
  const app = await buildApp(
    db,
    {
      handler: async () => new Response(),
      api: { getSession: async () => ({ user: { id: 'u' } }) },
    },
    { storage, origins: ['https://test.local'] },
  );
  const location = {
    name: '测试村庄',
    address: '安徽省黄山市黟县宏村',
    location: { lat: 30.001, lng: 117.991 },
    coordinate_system: 'GCJ-02',
    source: '腾讯地图地址解析',
    confirmed: true,
    notes: '接口验收',
  };
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: '测试村庄',
        mode: 'reality',
        geographic_location: location,
      },
    });
    expect(created.statusCode).toBe(200);
    const p = created.json();
    expect(p.geographic_location.name).toBe('测试村庄');
    expect(p.spatial.roads).toHaveLength(0);
    expect(p.location_version).toBe(1);
    const saved = await app.inject({ url: '/api/v1/projects/' + p.id });
    expect(saved.json().geographic_location.location.lat).toBe(30.001);
    const update = {
      method: 'PUT' as const,
      url: '/api/v1/projects/' + p.id + '/location',
      payload: {
        base_version: 1,
        location: { ...location, notes: '已补充片区范围' },
      },
    };
    expect((await app.inject(update)).statusCode).toBe(200);
    expect((await app.inject(update)).statusCode).toBe(409);
    const blank = await app.inject({
      method: 'PUT',
      url: '/api/v1/projects/' + p.id + '/initialization',
      payload: { base_version: 0, data: {} },
    });
    expect(blank.statusCode).toBe(200);
    expect(blank.json().initialization.goal).toBe('');
    expect(blank.json().initialization.focus).toEqual([]);
    const metadata = {
      route: '测试路线',
      lat: 30,
      lng: 118,
      accuracy: 10,
      located_at: new Date().toISOString(),
      allow_model: true,
    };
    const boundary = 'street-test';
    const uploadBody = Buffer.concat([
      Buffer.from(
        '--' +
          boundary +
          '\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n' +
          JSON.stringify(metadata) +
          '\r\n--' +
          boundary +
          '\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n',
      ),
      await readFile(
        new URL('../public/demo-courtyard-before.png', import.meta.url),
      ),
      Buffer.from('\r\n--' + boundary + '--\r\n'),
    ]);
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/' + p.id + '/street-photos',
      headers: { 'content-type': 'multipart/form-data; boundary=' + boundary },
      payload: uploadBody,
    });
    expect(upload.statusCode).toBe(200);
    const photos = (
      await app.inject({ url: '/api/v1/projects/' + p.id + '/street-photos' })
    ).json();
    expect(photos).toHaveLength(1);
    expect(photos[0].data.coordinate_system).toBe('WGS84');
    expect(photos[0].data.captured_at).toBeNull();
    expect(photos[0].data.accuracy).toBe(10);
    const walk = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/' + p.id + '/runs',
      payload: { type: 'streetwalk', photo_ids: [upload.json().id] },
    });
    expect(walk.statusCode).toBe(200);
    const previousStorage = process.env.MATERIALS_DIR;
    process.env.MATERIALS_DIR = storage;
    try {
      const row = (
        await db.query('SELECT * FROM runs WHERE id=$1', [walk.json().run_id])
      ).rows[0];
      await processRun(db, row, {} as any, new AbortController().signal);
      const completed = (
        await app.inject({
          url: '/api/v1/projects/' + p.id + '/runs/' + row.id,
        })
      ).json();
      expect(completed.status).toBe('completed');
      expect(completed.result.visits[0].photo_id).toBe(upload.json().id);
      expect(completed.events[0].stage).toBe('street_visit');
    } finally {
      if (previousStorage === undefined) delete process.env.MATERIALS_DIR;
      else process.env.MATERIALS_DIR = previousStorage;
    }

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/' + p.id + '/runs',
      payload: {
        type: 'streetwalk',
        photo_ids: ['00000000-0000-4000-8000-000000000000'],
      },
    });
    expect(denied.statusCode).toBe(422);
    const initialization = {
      method: 'PUT' as const,
      url: '/api/v1/projects/' + p.id + '/initialization',
      payload: {
        base_version: 1,
        data: {
          goal: '核查老人去助餐点的路线',
          area: '居住片区至助餐点',
          focus: ['步行通行', '助餐服务'],
        },
      },
    };
    const initialized = await app.inject(initialization);
    expect(initialized.statusCode).toBe(200);
    expect(initialized.json().initialization_version).toBe(2);
    const reopened = (
      await app.inject({ url: '/api/v1/projects/' + p.id })
    ).json();
    expect(reopened.initialization.goal).toBe(initialization.payload.data.goal);
    expect(reopened.initialization.source).toBe('用户录入，待现场核查');
    expect(reopened.spatial.roads).toHaveLength(0);
    expect((await app.inject(initialization)).statusCode).toBe(409);
    await db.query("UPDATE members SET role='recorder' WHERE project_id=$1", [
      p.id,
    ]);
    expect(
      (
        await app.inject({
          ...initialization,
          payload: { ...initialization.payload, base_version: 1 },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          ...update,
          payload: { ...update.payload, base_version: 2 },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await app.close();
    await pg.close();
    await rm(storage, { recursive: true, force: true });
  }
});
