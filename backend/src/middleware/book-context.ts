import { Env, BookContext, ApiResponse } from '../types';

/**
 * Book Context middleware
 *
 * 負責:
 *   1. 從 user_settings 拿出使用者的 active_book_id
 *   2. 驗證使用者仍是該 book 的成員 (防止被踢後 active_book 失效)
 *   3. 被踢時 auto-fallback 到任一其他 book
 *   4. 回傳 BookContext { userId, bookId, role }
 *
 * 若使用者完全沒有 book (理論上不應發生，因為註冊時自動建個人帳本) → 回傳 null
 */
export async function resolveBookContext(
  userId: string,
  env: Env
): Promise<BookContext | null> {
  // 1. 拿 active_book_id
  let settings = await env.DB.prepare(
    'SELECT active_book_id FROM user_settings WHERE user_id = ?'
  )
    .bind(userId)
    .first<{ active_book_id: string | null }>();

  // 沒有 settings 或 active_book_id 為 null → 找任一個 book 設為 active
  if (!settings?.active_book_id) {
    const fallback = await env.DB.prepare(
      'SELECT book_id FROM book_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1'
    )
      .bind(userId)
      .first<{ book_id: string }>();

    if (!fallback) return null;

    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT OR REPLACE INTO user_settings (user_id, active_book_id, updated_at) VALUES (?, ?, ?)'
    )
      .bind(userId, fallback.book_id, now)
      .run();

    settings = { active_book_id: fallback.book_id };
  }

  // 2. 驗證仍是該 book 的成員
  let member = await env.DB.prepare(
    'SELECT role FROM book_members WHERE book_id = ? AND user_id = ?'
  )
    .bind(settings.active_book_id, userId)
    .first<{ role: 'owner' | 'admin' | 'member' }>();

  let switchedTo: string | undefined;

  if (!member) {
    // 已被踢出 active_book → auto-fallback 到任一其他 book
    const fallback = await env.DB.prepare(
      'SELECT book_id FROM book_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1'
    )
      .bind(userId)
      .first<{ book_id: string }>();

    if (!fallback) return null;

    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE user_settings SET active_book_id = ?, updated_at = ? WHERE user_id = ?'
    )
      .bind(fallback.book_id, now, userId)
      .run();

    member = await env.DB.prepare(
      'SELECT role FROM book_members WHERE book_id = ? AND user_id = ?'
    )
      .bind(fallback.book_id, userId)
      .first<{ role: 'owner' | 'admin' | 'member' }>();

    if (!member) return null;

    settings.active_book_id = fallback.book_id;
    switchedTo = fallback.book_id;
  }

  return {
    userId,
    bookId: settings.active_book_id!,
    role: member.role,
    switchedTo,
  };
}

/** 403 Forbidden 統一回應 */
export function forbiddenResponse(message = '權限不足'): Response {
  return Response.json(
    { ok: false, error: message } satisfies ApiResponse,
    { status: 403 }
  );
}

/** 409 No Books 統一回應 */
export function noBooksResponse(): Response {
  return Response.json(
    { ok: false, error: '使用者沒有任何帳本' } satisfies ApiResponse,
    { status: 409 }
  );
}

/** 檢查 role 是否為 admin 或 owner (可以改設定/邀請/踢人) */
export function isAdminOrOwner(ctx: BookContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'owner';
}

/** 檢查 role 是否為 owner (唯一可刪帳本/轉移 owner) */
export function isOwner(ctx: BookContext): boolean {
  return ctx.role === 'owner';
}

/** 檢查使用者是否能編輯/刪除某筆 row (admin/owner 全權；member 只能改自己的) */
export function canModify(
  ctx: BookContext,
  row: { created_by: string }
): boolean {
  if (ctx.role === 'admin' || ctx.role === 'owner') return true;
  return row.created_by === ctx.userId;
}

/** 在 Response 上加 X-Active-Book-Switched header (告知 client 帳本被自動切換) */
export function withSwitchHeader(res: Response, ctx: BookContext): Response {
  if (!ctx.switchedTo) return res;
  const newRes = new Response(res.body, res);
  newRes.headers.set('X-Active-Book-Switched', ctx.switchedTo);
  return newRes;
}
