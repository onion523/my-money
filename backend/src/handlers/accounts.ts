import { Env, Account, ApiResponse } from '../types';

/** 取得使用者所有帳戶 */
export async function listAccounts(
  userId: string,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC'
  )
    .bind(userId)
    .all<Account>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一帳戶 */
export async function getAccount(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Account>();

  if (!row) {
    return Response.json(
      { ok: false, error: '帳戶不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增帳戶 */
export async function createAccount(
  userId: string,
  body: Partial<Account>,
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO accounts (id, user_id, name, type, currency, balance, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.name ?? '',
      body.type ?? 'bank',
      body.currency ?? 'TWD',
      body.balance ?? 0,
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

/** 更新帳戶 */
export async function updateAccount(
  userId: string,
  id: string,
  body: Partial<Account>,
  env: Env
): Promise<Response> {
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE accounts
     SET name = COALESCE(?, name),
         type = COALESCE(?, type),
         currency = COALESCE(?, currency),
         balance = COALESCE(?, balance),
         note = COALESCE(?, note),
         updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.name ?? null,
      body.type ?? null,
      body.currency ?? null,
      body.balance ?? null,
      body.note ?? null,
      now,
      id,
      userId
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

/** 刪除帳戶 */
export async function deleteAccount(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM accounts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '帳戶不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
