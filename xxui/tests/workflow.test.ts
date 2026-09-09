import { it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { MemorySaver, Command } from '@langchain/langgraph';
import { readFile } from 'node:fs/promises';
import { buildWorkflow } from '../server/workflow';
import { saveRecord } from '../server/store';
import { world } from './fixtures';
import type { DB } from '../server/db';
vi.mock('../server/cli', () => ({
  execute: vi.fn(async () => ({
    summary: '受控测试执行结果',
    missing_fields: ['现场核查'],
    calls: [],
    proposal: null,
    verdict: null,
  })),
}));
it('persists verification and approval interrupts across graph instances', async () => {
  const engine = new PGlite(),
    db: DB = {
      query: async (q, a) => {
        const r = await engine.query(q, a);
        return { rows: r.rows };
      },
    };
  try {
    await engine.exec(
      await readFile(
        new URL('../server/migrations/001.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.query(
      "INSERT INTO projects(id,name,mode,spatial) VALUES('p','合成','demo',$1)",
      [JSON.stringify(world())],
    );
    await db.query("INSERT INTO members VALUES('p','u','manager')");
    const f = await saveRecord(db, 'u', 'p', 'feedback', {
      base_version: 0,
      source: 'test',
      data: {
        text: '合成反馈',
        location: 'a',
        road_id: 'ab',
        confirmed: false,
        consent: 'allowed',
        allow_model: true,
        material_ids: [],
      },
    });
    await db.query(
      "INSERT INTO runs(id,project_id,world_version,type,status,input,created_by) VALUES('r','p',0,'agent','queued','{}','u')",
    );
    const saver = new MemorySaver(),
      config = { configurable: { thread_id: 'r' } };
    const graph = buildWorkflow(db, saver);
    await graph.invoke(
      { run_id: 'r', project_id: 'p', user_id: 'u', feedback_id: f.id },
      config,
    );
    expect((await graph.getState(config)).next).toContain('verify');
    await saveRecord(
      db,
      'u',
      'p',
      'feedback',
      { base_version: 1, source: 'test', data: { ...f.data, confirmed: true } },
      f.id,
    );
    const restarted = buildWorkflow(db, saver);
    await restarted.invoke(new Command({ resume: true }) as any, config);
    const state = await restarted.getState(config);
    expect(state.next).toContain('approval');
    expect(state.values.analysis.summary).toBe('受控测试执行结果');
    expect(
      (await db.query("SELECT status FROM runs WHERE id='r'")).rows[0].status,
    ).toBe('awaiting_approval');
  } finally {
    await engine.close();
  }
});
