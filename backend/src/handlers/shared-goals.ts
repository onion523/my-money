import { Env, SharedGoal, SharedGoalMember, ApiResponse } from '../types';

/** 產生隨機邀請碼（8 碼英數） */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}

/** 取得使用者所有共同儲蓄目標（建立者或成員） */
export async function listSharedGoals(
  userId: string,
  env: Env
): Promise<Response> {
  // 取得使用者參與的所有目標
  const { results: goals } = await env.DB.prepare(
    `SELECT DISTINCT sg.*
     FROM shared_goals sg
     LEFT JOIN shared_goal_members sgm ON sg.id = sgm.goal_id
     WHERE sg.creator_id = ? OR sgm.user_id = ?
     ORDER BY sg.created_at ASC`
  )
    .bind(userId, userId)
    .all<SharedGoal>();

  // 取得所有相關目標的成員
  if (goals.length === 0) {
    return Response.json({ ok: true, data: [] } satisfies ApiResponse);
  }

  const goalIds = goals.map((g) => g.id);
  const placeholders = goalIds.map(() => '?').join(',');
  const { results: members } = await env.DB.prepare(
    `SELECT * FROM shared_goal_members WHERE goal_id IN (${placeholders}) ORDER BY joined_at ASC`
  )
    .bind(...goalIds)
    .all<SharedGoalMember>();

  const membersByGoal = new Map<string, SharedGoalMember[]>();
  for (const m of members) {
    const list = membersByGoal.get(m.goal_id) ?? [];
    list.push(m);
    membersByGoal.set(m.goal_id, list);
  }

  const data = goals.map((g) => ({
    ...g,
    members: membersByGoal.get(g.id) ?? [],
  }));

  return Response.json({ ok: true, data } satisfies ApiResponse);
}

/** 取得單一共同儲蓄目標（含成員） */
export async function getSharedGoal(
  userId: string,
  goalId: string,
  env: Env
): Promise<Response> {
  const goal = await env.DB.prepare(
    'SELECT * FROM shared_goals WHERE id = ?'
  )
    .bind(goalId)
    .first<SharedGoal>();

  if (!goal) {
    return Response.json(
      { ok: false, error: '共同目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 確認使用者是成員
  const membership = await env.DB.prepare(
    'SELECT id FROM shared_goal_members WHERE goal_id = ? AND user_id = ?'
  )
    .bind(goalId, userId)
    .first();

  if (!membership && goal.creator_id !== userId) {
    return Response.json(
      { ok: false, error: '無權存取此共同目標' } satisfies ApiResponse,
      { status: 403 }
    );
  }

  const { results: members } = await env.DB.prepare(
    'SELECT * FROM shared_goal_members WHERE goal_id = ? ORDER BY joined_at ASC'
  )
    .bind(goalId)
    .all<SharedGoalMember>();

  return Response.json({
    ok: true,
    data: { ...goal, members },
  } satisfies ApiResponse);
}

/** 新增共同儲蓄目標 */
export async function createSharedGoal(
  userId: string,
  body: Partial<SharedGoal> & { user_name?: string },
  env: Env
): Promise<Response> {
  const id = body.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const inviteCode = generateInviteCode();
  const memberId = crypto.randomUUID();

  // 建立目標
  await env.DB.prepare(
    `INSERT INTO shared_goals
       (id, creator_id, name, target_amount, emoji, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.name ?? '',
      body.target_amount ?? '0',
      body.emoji ?? '🎯',
      inviteCode,
      now,
      now
    )
    .run();

  // 自動將建立者加為第一位成員
  await env.DB.prepare(
    `INSERT INTO shared_goal_members
       (id, goal_id, user_id, user_name, contributed_amount, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(memberId, id, userId, body.user_name ?? '建立者', '0', now)
    .run();

  return Response.json(
    { ok: true, data: { id, invite_code: inviteCode } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新共同儲蓄目標（僅建立者可操作） */
export async function updateSharedGoal(
  userId: string,
  goalId: string,
  body: Partial<SharedGoal>,
  env: Env
): Promise<Response> {
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE shared_goals
     SET name          = COALESCE(?, name),
         target_amount = COALESCE(?, target_amount),
         emoji         = COALESCE(?, emoji),
         updated_at    = ?
     WHERE id = ? AND creator_id = ?`
  )
    .bind(
      body.name ?? null,
      body.target_amount ?? null,
      body.emoji ?? null,
      now,
      goalId,
      userId
    )
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '共同目標不存在或無權修改' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { id: goalId } } satisfies ApiResponse);
}

/** 刪除共同儲蓄目標（僅建立者可操作） */
export async function deleteSharedGoal(
  userId: string,
  goalId: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM shared_goals WHERE id = ? AND creator_id = ?'
  )
    .bind(goalId, userId)
    .run();

  if (!result.meta.changed_db) {
    return Response.json(
      { ok: false, error: '共同目標不存在或無權刪除' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 刪除所有成員
  await env.DB.prepare(
    'DELETE FROM shared_goal_members WHERE goal_id = ?'
  )
    .bind(goalId)
    .run();

  return Response.json({ ok: true } satisfies ApiResponse);
}

/** 透過邀請碼加入共同儲蓄目標 */
export async function joinSharedGoal(
  userId: string,
  body: { invite_code: string; user_name: string },
  env: Env
): Promise<Response> {
  if (!body.invite_code) {
    return Response.json(
      { ok: false, error: '請提供邀請碼' } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const goal = await env.DB.prepare(
    'SELECT * FROM shared_goals WHERE invite_code = ?'
  )
    .bind(body.invite_code)
    .first<SharedGoal>();

  if (!goal) {
    return Response.json(
      { ok: false, error: '邀請碼無效' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 檢查是否已經是成員
  const existing = await env.DB.prepare(
    'SELECT id FROM shared_goal_members WHERE goal_id = ? AND user_id = ?'
  )
    .bind(goal.id, userId)
    .first();

  if (existing) {
    return Response.json(
      { ok: false, error: '已經是此目標的成員' } satisfies ApiResponse,
      { status: 409 }
    );
  }

  const memberId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO shared_goal_members
       (id, goal_id, user_id, user_name, contributed_amount, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(memberId, goal.id, userId, body.user_name ?? '', '0', now)
    .run();

  return Response.json(
    { ok: true, data: { id: memberId, goal_id: goal.id } } satisfies ApiResponse,
    { status: 201 }
  );
}

/** 更新成員貢獻金額（自己或建立者可操作） */
export async function updateMemberContribution(
  userId: string,
  goalId: string,
  memberId: string,
  body: { contributed_amount: string },
  env: Env
): Promise<Response> {
  // 取得目標以驗證建立者
  const goal = await env.DB.prepare(
    'SELECT creator_id FROM shared_goals WHERE id = ?'
  )
    .bind(goalId)
    .first<{ creator_id: string }>();

  if (!goal) {
    return Response.json(
      { ok: false, error: '共同目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 取得成員資料
  const member = await env.DB.prepare(
    'SELECT * FROM shared_goal_members WHERE id = ? AND goal_id = ?'
  )
    .bind(memberId, goalId)
    .first<SharedGoalMember>();

  if (!member) {
    return Response.json(
      { ok: false, error: '成員不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 僅自己或建立者可更新
  if (member.user_id !== userId && goal.creator_id !== userId) {
    return Response.json(
      { ok: false, error: '無權更新此成員的貢獻金額' } satisfies ApiResponse,
      { status: 403 }
    );
  }

  await env.DB.prepare(
    'UPDATE shared_goal_members SET contributed_amount = ? WHERE id = ?'
  )
    .bind(body.contributed_amount, memberId)
    .run();

  // 更新目標的 updated_at
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE shared_goals SET updated_at = ? WHERE id = ?'
  )
    .bind(now, goalId)
    .run();

  return Response.json({ ok: true, data: { id: memberId } } satisfies ApiResponse);
}

/** 移除成員（自己或建立者可操作） */
export async function removeMember(
  userId: string,
  goalId: string,
  memberId: string,
  env: Env
): Promise<Response> {
  // 取得目標以驗證建立者
  const goal = await env.DB.prepare(
    'SELECT creator_id FROM shared_goals WHERE id = ?'
  )
    .bind(goalId)
    .first<{ creator_id: string }>();

  if (!goal) {
    return Response.json(
      { ok: false, error: '共同目標不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 取得成員資料
  const member = await env.DB.prepare(
    'SELECT * FROM shared_goal_members WHERE id = ? AND goal_id = ?'
  )
    .bind(memberId, goalId)
    .first<SharedGoalMember>();

  if (!member) {
    return Response.json(
      { ok: false, error: '成員不存在' } satisfies ApiResponse,
      { status: 404 }
    );
  }

  // 僅自己或建立者可移除
  if (member.user_id !== userId && goal.creator_id !== userId) {
    return Response.json(
      { ok: false, error: '無權移除此成員' } satisfies ApiResponse,
      { status: 403 }
    );
  }

  await env.DB.prepare(
    'DELETE FROM shared_goal_members WHERE id = ?'
  )
    .bind(memberId)
    .run();

  return Response.json({ ok: true } satisfies ApiResponse);
}
