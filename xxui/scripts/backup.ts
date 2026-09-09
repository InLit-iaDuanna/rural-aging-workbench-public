import pg from 'pg';
import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const directory = process.argv[3];
if (!directory || !['backup', 'restore'].includes(process.argv[2]))
  throw new Error('用法：backup.ts backup|restore <目录>');
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const client = await pool.connect();
try {
  if (process.argv[2] === 'backup') {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query('LOCK TABLE materials IN SHARE MODE');
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename);
    const dependencies = (
      await client.query(
        "SELECT c.relname AS child,p.relname AS parent FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_class p ON p.oid=f.confrelid WHERE f.contype='f' AND c.relnamespace='public'::regnamespace",
      )
    ).rows;
    const ordered: string[] = [];
    while (ordered.length < tables.length) {
      const ready = tables.filter(
        (t) =>
          !ordered.includes(t) &&
          dependencies
            .filter((d) => d.child === t && d.parent !== t)
            .every((d) => ordered.includes(d.parent)),
      );
      if (!ready.length)
        throw new Error('存在循环外键；请使用 PostgreSQL pg_dump 备份');
      ordered.push(...ready);
    }
    const snapshot = [];
    for (const name of ordered) {
      const rows = (await client.query(`SELECT * FROM ${quote(name)}`)).rows;
      const cols = (
        await client.query(
          "SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [name],
        )
      ).rows;
      snapshot.push({ name, columns: cols, rows });
    }
    await writeFile(
      join(directory, 'database.json'),
      JSON.stringify({ format: 'xiangzhu-logical-v1', tables: snapshot }),
      { mode: 0o600 },
    );
    await cp(
      process.env.MATERIALS_DIR ?? 'work/materials',
      join(directory, 'materials'),
      { recursive: true },
    );
    await client.query('COMMIT');
    console.log('业务、认证、检查点及材料备份完成');
  } else {
    const snapshot = JSON.parse(
      await readFile(join(directory, 'database.json'), 'utf8'),
    );
    if (snapshot.format !== 'xiangzhu-logical-v1')
      throw new Error('备份格式不支持');
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      )
    ).rows.map((r) => r.tablename);
    await client.query('BEGIN');
    for (const t of snapshot.tables) {
      if (!tables.includes(t.name))
        throw new Error('先运行数据库迁移并初始化检查点表');
      if (
        Number(
          (await client.query(`SELECT count(*) AS n FROM ${quote(t.name)}`))
            .rows[0].n,
        ) !== 0
      )
        throw new Error('恢复目标必须为空库，不覆盖已有记录');
      for (const row of t.rows) {
        const columns = t.columns.map((c: any) => c.column_name);
        const values = t.columns.map((c: any) => {
          const v = row[c.column_name];
          return c.udt_name === 'bytea' && v?.type === 'Buffer'
            ? Buffer.from(v.data)
            : c.udt_name === 'jsonb' || c.udt_name === 'json'
              ? JSON.stringify(v)
              : v;
        });
        await client.query(
          `INSERT INTO ${quote(t.name)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_: string, i: number) => '$' + (i + 1)).join(',')})`,
          values,
        );
      }
      for (const c of t.columns) {
        const seq = (
          await client.query('SELECT pg_get_serial_sequence($1,$2) AS seq', [
            quote(t.name),
            c.column_name,
          ])
        ).rows[0].seq;
        if (seq) {
          const max = (
            await client.query(
              `SELECT max(${quote(c.column_name)}) AS n FROM ${quote(t.name)}`,
            )
          ).rows[0].n;
          if (max !== null)
            await client.query('SELECT setval($1,$2,true)', [seq, max]);
        }
      }
    }
    await client.query('COMMIT');
    await cp(
      join(directory, 'materials'),
      process.env.MATERIALS_DIR ?? 'work/materials',
      { recursive: true, errorOnExist: true, force: false },
    );
    console.log('已恢复数据库与材料；请验证登录、运行及附件');
  }
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
