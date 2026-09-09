import { demoSpatial, type Spatial } from '../lib/spatial';
import { exampleScenarios } from '../lib/v2/simulation';
export function world(): Spatial {
  const s = demoSpatial();
  return {
    ...s,
    version: 0,
    scale: 1,
    nodes: [
      { id: 'a', name: '住宅', x: 0, y: 0 },
      { id: 'b', name: '休息点', x: 20, y: 0 },
      { id: 'c', name: '助餐点', x: 40, y: 0 },
    ],
    roads: [
      {
        id: 'ab',
        a: 'a',
        b: 'b',
        width: 2,
        steps: false,
        lit: true,
        confirmed: true,
        access: '公开通行',
        source: '合成测试',
      },
      {
        id: 'bc',
        a: 'b',
        b: 'c',
        width: 2,
        steps: false,
        lit: true,
        confirmed: true,
        access: '公开通行',
        source: '合成测试',
      },
    ],
    hazards: [],
    buildings: [],
    config: { ...s.config, start: 'a', end: 'c', habit: [] },
  };
}
export function scenario(s = world()) {
  const sc = exampleScenarios(s)[0];
  sc.personas = sc.personas
    .slice(0, 3)
    .map((p) => ({ ...p, max_walk: 100, speed: 1 }));
  sc.resources[0].capacity = 1;
  sc.resources[0].duration = 10;
  return sc;
}
