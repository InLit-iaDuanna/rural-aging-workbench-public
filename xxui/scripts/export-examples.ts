import { writeFile } from 'node:fs/promises';
import { demoSpatial } from '../lib/spatial';
import { exampleScenarios } from '../lib/v2/simulation';
import { forms } from '../lib/v2/forms';
const world = demoSpatial();
world.roads = world.roads.map((r) => ({ ...r, confirmed: true }));
await writeFile(
  'examples/village-demo.json',
  JSON.stringify(
    {
      mode: 'demo',
      description:
        '全部村庄、角色、尺度、人口与容量均为合成示例，不代表真实试点',
      world,
      scenarios: exampleScenarios(world),
    },
    null,
    2,
  ),
);
await writeFile('examples/field-forms.json', JSON.stringify(forms, null, 2));
