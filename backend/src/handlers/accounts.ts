import { Env, Account, ApiResponse, BookContext } from '../types';
import {
  isAdminOrOwner,
  forbiddenResponse,
} from '../middleware/book-context';

/** 取得帳本所有帳戶 */
export async function listAccounts(
  ctx: BookContext,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM accounts WHERE book_id = ? ORDER BY created_at ASC'
  )
    .bind(ctx.bookId)
    .all<Account>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一帳戶 */
export async function getAccount(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<Account>();

  if (!row) {
    return Response.json(
      { ok: false, error: '帳戶不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增帳戶 (admin/owner only — 設定類資源) */
export async function createAccount(
  ctx: BookContext,
  body: Partial<Account>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以新增帳戶');
  }

  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO accounts (id, book_id, created_by, name, type, account_number, balance, billing_date, payment_date, billed_amount, unbilled_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      ctx.bookId,
      ctx.userId,
      body.name ?? '',
      body.type ?? 'bank',
      body.account_number ?? '',
      body.balance ?? '0',
      body.billing_date ?? null,
      body.payment_date ?? null,
      body.billed_amount ?? null,
      body.unbilled_amount ?? null,
      now,
      now
    )
    .run();

  return Response.json(
    { ok: true, data: { id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新帳戶 (admin/owner only) */
export async function updateAccount(
  ctx: BookContext,
  id: string,
  body: Partial<Account>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以編輯帳戶');
  }

  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE accounts
     SET name            = COALESCE(?, name),
         type            = COALESCE(?, type),
         account_number  = COALESCE(?, account_number),
         balance         = COALESCE(?, balance),
         billing_date    = COALESCE(?, billing_date),
         payment_date    = COALESCE(?, payment_date),
         billed_amount   = COALESCE(?, billed_amount),
         unbilled_amount = COALESCE(?, unbilled_amount),
         updated_at      = ?
     WHERE id = ? AND book_id = ?`
  )
    .bind(
      body.name ?? null,
      body.type ?? null,
      body.account_number ?? null,
      body.balance ?? null,
      body.billing_date ?? null,
      body.payment_date ?? null,
      body.billed_amount ?? null,
      body.unbilled_amount ?? null,
      now,
      id,
      ctx.bookId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '帳戶不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除帳戶 (admin/owner only) */
export async function deleteAccount(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以刪除帳戶');
  }

  const result = await env.DB.prepare(
    'DELETE FROM accounts WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '帳戶不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
