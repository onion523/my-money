import { Env, FixedExpense, ApiResponse } from '../types';

/** 取得使用者所有固定支出 */
export async function listFixedExpenses(
  userId: string,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM fixed_expenses WHERE user_id = ? ORDER BY due_day ASC'
  )
    .bind(userId)
    .all<FixedExpense>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一固定支出 */
export async function getFixedExpense(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<FixedExpense>();

  if (!row) {
    return Response.json(
      { ok: false, error: '固定支出不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增固定支出 */
export async function createFixedExpense(
  userId: string,
  body: Partial<FixedExpense>,
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO fixed_expenses
       (id, user_id, name, amount, frequency, due_day, account_id, category, note, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.name ?? '',
      body.amount ?? 0,
      body.frequency ?? 'monthly',
      body.due_day ?? 1,
      body.account_id ?? '',
      body.category ?? '',
      body.note ?? null,
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

/** 更新固定支出 */
export async function updateFixedExpense(
  userId: string,
  id: string,
  body: Partial<FixedExpense>,
  env: Env
): Promise<Response> {
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE fixed_expenses
     SET name       = COALESCE(?, name),
         amount     = COALESCE(?, amount),
         frequency  = COALESCE(?, frequency),
         due_day    = COALESCE(?, due_day),
         account_id = COALESCE(?, account_id),
         category   = COALESCE(?, category),
         note       = COALESCE(?, note),
         is_active  = COALESCE(?, is_active),
         updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.name ?? null,
      body.amount ?? null,
      body.frequency ?? null,
      body.due_day ?? null,
      body.account_id ?? null,
      body.category ?? null,
      body.note ?? null,
      body.is_active ?? null,
      now,
      id,
      userId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '固定支出不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除固定支出 */
export async function deleteFixedExpense(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM fixed_expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '固定支出不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
