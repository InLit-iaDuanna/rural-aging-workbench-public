import pg from 'pg';
export type DB = {
  query: (
    sql: string,
    args?: any[],
  ) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<any>;
};
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export async function transaction<T>(
  db: DB,
  fn: (tx: DB) => Promise<T>,
): Promise<T> {
  const tx = db.connect ? await db.connect() : db;
  await tx.query('BEGIN');
  try {
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (e) {
    await tx.query('ROLLBACK');
    throw e;
  } finally {
    if ('release' in tx) (tx as any).release();
  }
}
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function one(db: DB, sql: string, args: any[] = []) {
  return (await db.query(sql, args)).rows[0];
}
export async function audit(
  db: DB,
  user: string,
  project: string | null,
  action: string,
  id: string | null = null,
  payload: unknown = {},
) {
  await db.query(
    'INSERT INTO audit(user_id,project_id,action,object_id,payload) VALUES($1,$2,$3,$4,$5)',
    [user, project, action, id, JSON.stringify(payload)],
  );
}
