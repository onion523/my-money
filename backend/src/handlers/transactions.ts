import { Env, Transaction, ApiResponse } from '../types';

/** 取得使用者所有交易紀錄（支援分頁與日期篩選） */
export async function listTransactions(
  userId: string,
  url: URL,
  env: Env
): Promise<Response> {
  // 查詢參數：?from=2026-01-01&to=2026-03-31&limit=50&offset=0
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const binds: unknown[] = [userId];

  if (from) {
    sql += ' AND date >= ?';
    binds.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    binds.push(to);
  }

  sql += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const stmt = env.DB.prepare(sql);
  const { results } = await stmt.bind(...binds).all<Transaction>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一交易紀錄 */
export async function getTransaction(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Transaction>();

  if (!row) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增交易紀錄 */
export async function createTransaction(
  userId: string,
  body: Partial<Transaction>,
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO transactions
       (id, user_id, account_id, type, amount, category, description, date, related_account_id, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.account_id ?? '',
      body.type ?? 'expense',
      body.amount ?? 0,
      body.category ?? '',
      body.description ?? null,
      body.date ?? now.slice(0, 10),
      body.related_account_id ?? null,
      body.note ?? null,
      now,
      now
    )
    .run();

  return Response.json(
    { ok: true, data: { id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新交易紀錄 */
export async function updateTransaction(
  userId: string,
  id: string,
  body: Partial<Transaction>,
  env: Env
): Promise<Response> {
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE transactions
     SET account_id         = COALESCE(?, account_id),
         type               = COALESCE(?, type),
         amount             = COALESCE(?, amount),
         category           = COALESCE(?, category),
         description        = COALESCE(?, description),
         date               = COALESCE(?, date),
         related_account_id = COALESCE(?, related_account_id),
         note               = COALESCE(?, note),
         updated_at         = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.account_id ?? null,
      body.type ?? null,
      body.amount ?? null,
      body.category ?? null,
      body.description ?? null,
      body.date ?? null,
      body.related_account_id ?? null,
      body.note ?? null,
      now,
      id,
      userId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除交易紀錄 */
export async function deleteTransaction(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM transactions WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
