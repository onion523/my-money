import { Env, FixedExpense, ApiResponse, BookContext } from '../types';
import {
  isAdminOrOwner,
  forbiddenResponse,
} from '../middleware/book-context';

/** 取得帳本所有固定收支 */
export async function listFixedExpenses(
  ctx: BookContext,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM fixed_expenses WHERE book_id = ? ORDER BY due_day ASC'
  )
    .bind(ctx.bookId)
    .all<FixedExpense>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一固定收支 */
export async function getFixedExpense(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM fixed_expenses WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<FixedExpense>();

  if (!row) {
    return Response.json(
      { ok: false, error: '固定收支不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增固定收支 (admin/owner only) */
export async function createFixedExpense(
  ctx: BookContext,
  body: Partial<FixedExpense>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以新增固定收支');
  }

  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO fixed_expenses
       (id, book_id, created_by, name, type, amount, cycle, due_date, due_day, payment_method, account_id, category, note, reserved_amount, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      ctx.bookId,
      ctx.userId,
      body.name ?? '',
      body.type ?? 'expense',
      body.amount ?? '0',
      body.cycle ?? 'monthly',
      body.due_date ?? null,
      body.due_day ?? 1,
      body.payment_method ?? '',
      body.account_id ?? '',
      body.category ?? '',
      body.note ?? null,
      body.reserved_amount ?? '0',
      body.is_active ?? 1,
      now,
      now
    )
    .run();

  return Response.json(
    { ok: true, data: { id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新固定收支 (admin/owner only) */
export async function updateFixedExpense(
  ctx: BookContext,
  id: string,
  body: Partial<FixedExpense>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以編輯固定收支');
  }

  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE fixed_expenses
     SET name            = COALESCE(?, name),
         type            = COALESCE(?, type),
         amount          = COALESCE(?, amount),
         cycle           = COALESCE(?, cycle),
         due_date        = COALESCE(?, due_date),
         due_day         = COALESCE(?, due_day),
         payment_method  = COALESCE(?, payment_method),
         account_id      = COALESCE(?, account_id),
         category        = COALESCE(?, category),
         note            = COALESCE(?, note),
         reserved_amount = COALESCE(?, reserved_amount),
         is_active       = COALESCE(?, is_active),
         updated_at      = ?
     WHERE id = ? AND book_id = ?`
  )
    .bind(
      body.name ?? null,
      body.type ?? null,
      body.amount ?? null,
      body.cycle ?? null,
      body.due_date ?? null,
      body.due_day ?? null,
      body.payment_method ?? null,
      body.account_id ?? null,
      body.category ?? null,
      body.note ?? null,
      body.reserved_amount ?? null,
      body.is_active ?? null,
      now,
      id,
      ctx.bookId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '固定收支不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除固定收支 (admin/owner only) */
export async function deleteFixedExpense(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以刪除固定收支');
  }

  const result = await env.DB.prepare(
    'DELETE FROM fixed_expenses WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '固定收支不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
