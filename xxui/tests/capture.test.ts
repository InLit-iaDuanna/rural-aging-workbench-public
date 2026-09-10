import { expect, it } from 'vitest';
import { metres, spacing, freshFix, type Fix } from '../lib/v2/capture';
import { streetMetadata } from '../lib/v2/street';
const f: Fix = {
  lat: 0,
  lng: 0,
  accuracy: 5,
  located_at: '2026-09-10T00:00:00.000Z',
  heading: null,
  speed: null,
  altitude: null,
};
it('uses metres on WGS84 and ignores overlapping GPS uncertainty for spacing', () => {
  expect(metres(f, { ...f, lng: 0.001 })).toBeCloseTo(111.195, 2);
  expect(spacing(f, { ...f, lng: 0.0003, accuracy: 30 }, 30).ready).toBe(false);
  expect(spacing(f, { ...f, lng: 0.0005 }, 30).ready).toBe(true);
  expect(spacing(null, f, 30).ready).toBe(true);
  expect(spacing(f, null, 30).ready).toBe(false);
});
it('requires a recent fix and preserves actual camera timestamp without AI consent', () => {
  expect(freshFix(f, Date.parse(f.located_at) + 15001)).toBe(false);
  expect(freshFix(f, Date.parse(f.located_at) + 500)).toBe(true);
  const data = streetMetadata.parse({
    ...f,
    route: '路线',
    captured_at: '2026-09-10T00:00:01.000Z',
    allow_model: false,
  });
  expect(data.captured_at).toBe('2026-09-10T00:00:01.000Z');
  expect(data.allow_model).toBe(false);
});
