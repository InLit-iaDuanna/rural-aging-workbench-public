import { it, expect, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerTencentMap } from '../server/tencent-map';
import { villageSchema } from '../lib/v2/village';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('uses place search for names, preserves chosen address and provenance for saving', async () => {
  vi.stubEnv('TENCENT_MAP_KEY', 'test');
  vi.stubEnv('TENCENT_MAP_SK', 'test');
  const fetcher = vi.fn(
    async (_url: string) =>
      new Response(
        JSON.stringify({
          status: 0,
          data: [
            {
              id: 'campus',
              title: '四川美术学院(虎溪校区)',
              address: '重庆市沙坪坝区大学城南路28号',
              location: { lat: 29.602831, lng: 106.29754 },
              adcode: 500106,
            },
          ],
        }),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const app = Fastify();
  registerTencentMap(app);
  try {
    const r = await app.inject({
      url: '/api/v1/map/search?keyword=' + encodeURIComponent('四川美术学院'),
    });
    expect(r.statusCode).toBe(200);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/ws/place/v1/suggestion');
    expect(url.searchParams.get('keyword')).toBe('四川美术学院');
    const p = r.json().results[0];
    expect(
      villageSchema.parse({
        ...p,
        name: p.title,
        coordinate_system: 'GCJ-02',
        confirmed: true,
      }).source,
    ).toBe('腾讯地图地点检索');
    expect(p.address).toBe('重庆市沙坪坝区大学城南路28号');
  } finally {
    await app.close();
  }
});
