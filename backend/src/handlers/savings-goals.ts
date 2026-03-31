import { Env, SavingsGoal, ApiResponse } from '../types';

/** 取得使用者所有儲蓄目標 */
export async function listSavingsGoals(
  userId: string,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at ASC'
  )
    .bind(userId)
    .all<SavingsGoal>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一儲蓄目標 */
export async function getSavingsGoal(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM savings_goals WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<SavingsGoal>();

  if (!row) {
    return Response.json(
      { ok: false, error: '儲蓄目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增儲蓄目標 */
export async function createSavingsGoal(
  userId: string,
  body: Partial<SavingsGoal>,
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO savings_goals
       (id, user_id, name, target_amount, current_amount, category, deadline, monthly_reserve, emoji, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.name ?? '',
      body.target_amount ?? '0',
      body.current_amount ?? '0',
      body.category ?? '',
      body.deadline ?? null,
      body.monthly_reserve ?? '0',
      body.emoji ?? '🎯',
      now,
      now
    )
    .run();

  return Response.json(
    { ok: true, data: { id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新儲蓄目標 */
export async function updateSavingsGoal(
  userId: string,
  id: string,
  body: Partial<SavingsGoal>,
  env: Env
): Promise<Response> {
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE savings_goals
     SET name            = COALESCE(?, name),
         target_amount   = COALESCE(?, target_amount),
         current_amount  = COALESCE(?, current_amount),
         category        = COALESCE(?, category),
         deadline        = COALESCE(?, deadline),
         monthly_reserve = COALESCE(?, monthly_reserve),
         emoji           = COALESCE(?, emoji),
         updated_at      = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.name ?? null,
      body.target_amount ?? null,
      body.current_amount ?? null,
      body.category ?? null,
      body.deadline ?? null,
      body.monthly_reserve ?? null,
      body.emoji ?? null,
      now,
      id,
      userId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '儲蓄目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id } } satisfies ApiResponse);
}

/** 刪除儲蓄目標 */
export async function deleteSavingsGoal(
  userId: string,
  id: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM savings_goals WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '儲蓄目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
