import { Env, SavingsGoal, ApiResponse, BookContext } from '../types';
import {
  isAdminOrOwner,
  forbiddenResponse,
} from '../middleware/book-context';

/** 取得帳本所有儲蓄目標 */
export async function listSavingsGoals(
  ctx: BookContext,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM savings_goals WHERE book_id = ? ORDER BY created_at ASC'
  )
    .bind(ctx.bookId)
    .all<SavingsGoal>();

  return Response.json({ ok: true, data: results } satisfies ApiResponse);
}

/** 取得單一儲蓄目標 */
export async function getSavingsGoal(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM savings_goals WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .first<SavingsGoal>();

  if (!row) {
    return Response.json(
      { ok: false, error: '儲蓄目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: row } satisfies ApiResponse);
}

/** 新增儲蓄目標 (admin/owner only) */
export async function createSavingsGoal(
  ctx: BookContext,
  body: Partial<SavingsGoal>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以新增儲蓄目標');
  }

  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO savings_goals
       (id, book_id, created_by, name, target_amount, current_amount, category, deadline, monthly_reserve, emoji, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      ctx.bookId,
      ctx.userId,
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

/** 更新儲蓄目標 (admin/owner only) */
export async function updateSavingsGoal(
  ctx: BookContext,
  id: string,
  body: Partial<SavingsGoal>,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以編輯儲蓄目標');
  }

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
     WHERE id = ? AND book_id = ?`
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
      ctx.bookId
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

/** 刪除儲蓄目標 (admin/owner only) */
export async function deleteSavingsGoal(
  ctx: BookContext,
  id: string,
  env: Env
): Promise<Response> {
  if (!isAdminOrOwner(ctx)) {
    return forbiddenResponse('只有管理者可以刪除儲蓄目標');
  }

  const result = await env.DB.prepare(
    'DELETE FROM savings_goals WHERE id = ? AND book_id = ?'
  )
    .bind(id, ctx.bookId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '儲蓄目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true } satisfies ApiResponse);
}
