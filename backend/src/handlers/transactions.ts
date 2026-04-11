import { Env, Transaction, ApiResponse, BookContext } from '../types';
import { canModify, forbiddenResponse } from '../middleware/book-context';

/** 取得帳本所有交易紀錄（支援分頁與日期篩選） */
export async function listTransactions(
  ctx: BookContext,
  url: URL,
  env: Env
): Promise<Response> {
  // 查詢參數：?from=2026-01-01&to=2026-03-31&limit=50&offset=0
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  let sql = 'SELECT * FROM transactions WHERE book_id = ?';
  const binds: unknown[] = [ctx.bookId];

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
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<Transaction>();

  if (!row) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增交易紀錄 (任何成員都能新增) */
export async function createTransaction(
  ctx: BookContext,
  body: Partial<Transaction>,
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO transactions
       (id, book_id, created_by, type, amount, date, note, category, account_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      ctx.bookId,
      ctx.userId,
      body.type ?? 'expense',
      body.amount ?? '0',
      body.date ?? now.slice(0, 10),
      body.note ?? '',
      body.category ?? '',
      body.account_id ?? null,
      now,
      now
    )
    .run();

  return Response.json(
    { ok: true, data: { id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新交易紀錄 (admin/owner 全權；member 只能改自己記的) */
export async function updateTransaction(
  ctx: BookContext,
  id: string,
  body: Partial<Transaction>,
  env: Env
): Promise<Response> {
  // 先讀出該筆 row 看 created_by
  const existing = await env.DB.prepare(
    'SELECT created_by FROM transactions WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<{ created_by: string }>();

  if (!existing) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  if (!canModify(ctx, existing)) {
    return forbiddenResponse('只能編輯自己記的交易');
  }

  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE transactions
     SET type       = COALESCE(?, type),
         amount     = COALESCE(?, amount),
         date       = COALESCE(?, date),
         note       = COALESCE(?, note),
         category   = COALESCE(?, category),
         account_id = COALESCE(?, account_id),
         updated_at = ?
     WHERE id = ? AND book_id = ?`
  )
    .bind(
      body.type ?? null,
      body.amount ?? null,
      body.date ?? null,
      body.note ?? null,
      body.category ?? null,
      body.account_id ?? null,
      now,
      id,
      ctx.bookId
    )
    .run();

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除交易紀錄 (admin/owner 全權；member 只能刪自己記的) */
export async function deleteTransaction(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT created_by FROM transactions WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<{ created_by: string }>();

  if (!existing) {
    return Response.json(
      { ok: false, error: '交易紀錄不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  if (!canModify(ctx, existing)) {
    return forbiddenResponse('只能刪除自己記的交易');
  }

  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND book_id = ?')
    .bind(id, ctx.bookId)
    .run();

  return Response.json({ ok: true } satisfies ApiResponse);
}
