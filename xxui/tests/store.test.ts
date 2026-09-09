import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import {
  authorize,
  saveRecord,
  confirmProposal,
  saveWorld,
  getRecord,
} from '../server/store';
import { type DB } from '../server/db';
import { world, scenario } from './fixtures';
let engine: PGlite, db: DB;
beforeEach(async () => {
  engine = new PGlite();
  db = {
    query: async (sql, args) => {
      const r = await engine.query(sql, args);
      return { rows: r.rows, rowCount: r.affectedRows };
    },
  };
  await engine.exec(
    await readFile(
      new URL('../server/migrations/001.sql', import.meta.url),
      'utf8',
    ),
  );
  for (const id of ['village', 'other'])
    await db.query(
      "INSERT INTO projects(id,name,mode,spatial) VALUES($1,$1,'demo',$2)",
      [id, JSON.stringify(world())],
    );
  await db.query(
    "INSERT INTO members VALUES('village','manager','manager'),('village','reviewer','reviewer'),('village','recorder','recorder')",
  );
});
afterEach(async () => {
  await engine.close();
});
const input = (data: any) => ({
  base_version: 0,
  source: '合成测试资料',
  data,
});
async function makeProposal() {
  const sc = await saveRecord(
    db,
    'manager',
    'village',
    'scenario',
    input(scenario()),
  );
  const evidence = await saveRecord(
    db,
    'manager',
    'village',
    'evidence',
    input({
      title: '示例证据',
      url: 'https://example.com',
      locator: '段落1',
      excerpt: '合成测试片段',
      claim: '测试主张',
      type: 'case',
      stage: 'planned',
      tags: [],
      conditions: '测试条件',
      limitations: '不是现实证据',
      verified: true,
      material_ids: [],
    }),
  );
  const p = await saveRecord(
    db,
    'manager',
    'village',
    'proposal',
    input({
      title: '候选方案',
      issue_ids: [],
      scenario_id: sc.id,
      evidence_ids: [evidence.id],
      changes: [],
      tasks: [
        { title: '核查现场', type: 'verification', description: '查实通行' },
      ],
      missing_fields: [],
      budget: '待测算',
      status: 'draft',
      simulation_ids: [],
    }),
  );
  return p;
}
describe('PostgreSQL business transactions', () => {
  it('rejects cross-project access and records the denial', async () => {
    await expect(authorize(db, 'manager', 'other')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(
      (await db.query("SELECT * FROM audit WHERE action='denied'")).rows,
    ).toHaveLength(1);
  });
  it('rejects ambiguous concurrent edits', async () => {
    const f = await saveRecord(
      db,
      'recorder',
      'village',
      'feedback',
      input({
        text: '桥头积水',
        location: '桥头',
        road_id: 'ab',
        consent: 'allowed',
        confirmed: false,
        allow_model: false,
        material_ids: [],
      }),
    );
    await saveRecord(
      db,
      'recorder',
      'village',
      'feedback',
      { ...input({ ...f.data, text: '更新后的原话' }), base_version: 1 },
      f.id,
    );
    await expect(
      saveRecord(
        db,
        'recorder',
        'village',
        'feedback',
        { ...input(f.data), base_version: 1 },
        f.id,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('requires independent review and confirms once on retry', async () => {
    const p = await makeProposal();
    await expect(
      saveRecord(
        db,
        'manager',
        'village',
        'review',
        input({
          proposal_id: p.id,
          verdict: 'pass',
          notes: '审核',
          evidence_ids: p.data.evidence_ids,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await saveRecord(
      db,
      'reviewer',
      'village',
      'review',
      input({
        proposal_id: p.id,
        verdict: 'pass',
        notes: '已核对原始材料',
        evidence_ids: p.data.evidence_ids,
      }),
    );
    const result = await confirmProposal(
      db,
      'manager',
      'village',
      p.id,
      2,
      'request-1',
    );
    expect(
      await confirmProposal(db, 'manager', 'village', p.id, 2, 'request-1'),
    ).toEqual(result);
    expect(
      (await db.query("SELECT * FROM records WHERE kind='action'")).rows,
    ).toHaveLength(1);
  });
  it('invalidates old proposals and simulations on world updates', async () => {
    const p = await makeProposal();
    await saveWorld(db, 'manager', 'village', 0, world(), '合成变更');
    expect((await getRecord(db, 'village', p.id)).stale).toBe(true);
    await expect(
      confirmProposal(db, 'manager', 'village', p.id, 1, 'x'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('keeps reality unchanged when closing an action through followup', async () => {
    const p = await makeProposal();
    await saveRecord(
      db,
      'reviewer',
      'village',
      'review',
      input({
        proposal_id: p.id,
        verdict: 'pass',
        notes: '通过',
        evidence_ids: p.data.evidence_ids,
      }),
    );
    const r = await confirmProposal(db, 'manager', 'village', p.id, 2, 'r');
    let a = await getRecord(db, 'village', r.action_ids[0]);
    for (const status of ['in_progress', 'followup'])
      a = await saveRecord(
        db,
        'manager',
        'village',
        'action',
        { ...input({ ...a.data, status }), base_version: a.version },
        a.id,
      );
    await saveRecord(
      db,
      'recorder',
      'village',
      'followup',
      input({
        action_id: a.id,
        text: '原反馈人确认解决',
        result: 'resolved',
        material_ids: [],
        observed_at: new Date().toISOString(),
      }),
    );
    expect((await getRecord(db, 'village', a.id)).data.status).toBe('closed');
    expect(
      (await db.query("SELECT version FROM projects WHERE id='village'"))
        .rows[0].version,
    ).toBe(0);
  });
});
