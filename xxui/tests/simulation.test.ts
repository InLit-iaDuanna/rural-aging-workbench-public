import { describe, it, expect } from 'vitest';
import {
  demoSpatial,
  emptySpatial,
  calculateRoute,
  normalizeSpatial,
  hasMetricScale,
  type Spatial,
} from '../lib/spatial';
import { simulate, exampleScenarios } from '../lib/v2/simulation';
import { world, scenario } from './fixtures';
describe('shared spatial model', () => {
  it('never emits metric lengths for an uncalibrated real image', () => {
    const s = {
      ...world(),
      mode: 'upload' as const,
      calibration: {
        status: 'unknown' as const,
        source: 'test',
        unit: 'm' as const,
      },
    };
    expect(calculateRoute(s, s.config, 'shortest').length).toBeNull();
    expect(calculateRoute(s, s.config, 'shortest').reachable).toBe(true);
  });
  it('migrates unverified V1 facts to unknown', () => {
    const s = { ...world(), mode: 'upload' as const };
    delete s.calibration;
    const n = normalizeSpatial(s);
    expect(hasMetricScale(n)).toBe(false);
    expect(n.roads.every((r) => r.steps === null && r.access === '未知')).toBe(
      true,
    );
  });
  it('uses both calibrated axes', () => {
    const s = world();
    s.nodes[1].y = 20;
    s.calibration = { status: 'manual', source: 'test', unit: 'm', scaleY: 2 };
    expect(calculateRoute(s, s.config, 'shortest').length).toBeCloseTo(
      2 * Math.hypot(20, 40),
    );
  });
});
describe('discrete simulation', () => {
  it('serializes capacity and actually waits', async () => {
    const r = await simulate(world(), scenario());
    expect(r.metrics.completed).toBe(3);
    expect(r.metrics.waiting).toBeGreaterThan(0);
    expect(r.metrics.conflicts).toBeGreaterThan(0);
  });
  it('rejects arbitrary targets', async () => {
    const r = await simulate(world(), scenario(), {
      decide: async () => ({
        action: 'walk',
        target_id: 'outside',
        reason: 'invalid',
      }),
    });
    expect(r.metrics.rejected).toBe(3);
    expect(r.metrics.completed).toBe(0);
    expect(r.events.every((e) => !e.accepted)).toBe(true);
  });
  it('a real decision changes outcome and saved decisions reproduce the run', async () => {
    const s = world(),
      sc = scenario();
    const r = await simulate(s, sc, {
      decide: async (c) => ({ ...c.legal[0], reason: 'selected legal action' }),
    });
    const replay = await simulate(s, sc, { replay: r.decisions });
    expect(replay.events).toEqual(r.events);
    expect(replay.metrics).toEqual(r.metrics);
    const help = await simulate(s, sc, {
      decide: async () => ({
        action: 'request_help',
        target_id: null,
        reason: 'request assistance',
      }),
    });
    expect(help.metrics.completed).toBe(0);
    expect(r.metrics.completed).toBe(3);
  });
  it('a changed step condition changes accessibility', async () => {
    const s = world();
    s.roads[0].steps = true;
    const sc = scenario(s);
    sc.personas = sc.personas.slice(0, 1);
    const old = await simulate(s, sc);
    const changed = await simulate(s, {
      ...sc,
      type: 'engineering',
      patches: [{ road_id: 'ab', steps: false }],
    });
    expect(old.metrics.completed).toBe(0);
    expect(changed.metrics.completed).toBe(1);
  });
  it('stops for unknown conditions and stale scenarios', async () => {
    const s = world();
    s.roads[0].steps = null;
    const r = await simulate(s, scenario());
    expect(r.metrics.completed).toBe(0);
    expect(r.metrics.missing_fields).toContain('ab:unverified_conditions');
    await expect(
      simulate(s, { ...scenario(), world_version: 1 }),
    ).rejects.toThrow('版本');
  });
  it('suppresses missing-scale timing', async () => {
    const s = world();
    s.calibration = emptySpatial().calibration;
    const r = await simulate(s, scenario());
    expect(r.metrics.distance).toBeNull();
    expect(r.metrics.waiting).toBeNull();
  });
});
