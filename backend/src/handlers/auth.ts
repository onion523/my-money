import { Hono } from 'hono';
import { Env } from '../types';
import { hashPasswordPBKDF2, verifyPassword, generateSalt, generateId, createJWT, authMiddleware } from '../middleware/jwt';
import { handleHouseholdMemberDeparture } from './households';
import { clearAuthFailures, ensureOAuthSchema, getClientIp, isRateLimited, recordAuthFailure, rehashPasswordIfNeeded } from './oauth';

const auth = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string; userName: string; sessionId?: string } }>();

// POST /auth/register
auth.post('/register', async (c) => {
  if (c.env.LEGACY_AUTH_ENABLED === 'false') {
    return c.json({ success: false, error: '舊版登入端點已停用，請使用新版登入流程' }, 410);
  }
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) return c.json({ success: false, error: '請填寫所有欄位' }, 400);
  if (password.length < 6) return c.json({ success: false, error: '密碼至少 6 個字元' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return c.json({ success: false, error: '此 Email 已被使用' }, 409);

  const salt = generateSalt();
  const hash = await hashPasswordPBKDF2(password, salt);
  const id = generateId();

  await c.env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email.toLowerCase(), name, hash, salt).run();

  const token = await createJWT({ sub: id, email: email.toLowerCase(), name }, c.env.JWT_SECRET || 'dev-secret-key');
  return c.json({ success: true, data: { token, user: { id, email: email.toLowerCase(), name } } }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  if (c.env.LEGACY_AUTH_ENABLED === 'false') {
    return c.json({ success: false, error: '舊版登入端點已停用，請使用新版登入流程' }, 410);
  }
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ success: false, error: '請填寫 Email 和密碼' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string; email: string; name: string; password_hash: string; salt: string }>();
  if (!user) return c.json({ success: false, error: 'Email 或密碼錯誤' }, 401);

  const { valid, needsRehash } = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) return c.json({ success: false, error: 'Email 或密碼錯誤' }, 401);

  if (needsRehash) {
    await rehashPasswordIfNeeded(c.env.DB, user.id, password);
  }

  const token = await createJWT({ sub: user.id, email: user.email, name: user.name }, c.env.JWT_SECRET || 'dev-secret-key');
  return c.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
});


// DELETE /auth/account (App Store Review Guideline 5.1.1(v) 要求；ADR 0035 #121 自動移交家庭擁有權)
auth.delete('/account', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ success: false, error: '帳號不存在' }, 404);

  // 若所屬家庭尚有其他成員，先將家庭 created_by 與 admin 權限移交給下一順位成員，避免 ON DELETE CASCADE 連帶刪除整個家庭
  await handleHouseholdMemberDeparture(c.env.DB, userId);

  // 刪除用戶 (外鍵 ON DELETE CASCADE 會自動連帶清除帳戶、交易、目標、預算、綁定等全部資料)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  return c.json({ success: true, message: '帳號及其所有個人資料已全數刪除' });
});

// GET /auth/sessions (列出自己有效的工作階段)
auth.get('/sessions', authMiddleware, async (c) => {
  await ensureOAuthSchema(c.env.DB);
  const userId = c.get('userId');
  const currentSid = c.get('sessionId');
  const now = Math.floor(Date.now() / 1000);

  const { results } = await c.env.DB.prepare(
    `SELECT id, client_id, device_name, created_at, last_used_at, expires_at
     FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at >= ?
     ORDER BY last_used_at DESC`
  )
    .bind(userId, now)
    .all<{
      id: string;
      client_id: string;
      device_name: string;
      created_at: number;
      last_used_at: number;
      expires_at: number;
    }>();

  return c.json({
    success: true,
    data: results.map((s) => ({
      id: s.id,
      client_id: s.client_id,
      device_name: s.device_name,
      created_at: s.created_at,
      last_used_at: s.last_used_at,
      expires_at: s.expires_at,
      current: currentSid ? s.id === currentSid : false,
    })),
  });
});

// DELETE /auth/sessions?scope=others (登出其他所有裝置)
auth.delete('/sessions', authMiddleware, async (c) => {
  await ensureOAuthSchema(c.env.DB);
  if (c.req.query('scope') !== 'others') {
    return c.json({ success: false, error: '不支援的參數，請指定 scope=others' }, 400);
  }
  const userId = c.get('userId');
  const currentSid = c.get('sessionId');
  const now = Math.floor(Date.now() / 1000);

  const res = currentSid
    ? await c.env.DB.prepare(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL'
      )
        .bind(now, userId, currentSid)
        .run()
    : await c.env.DB.prepare(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
      )
        .bind(now, userId)
        .run();

  return c.json({ success: true, data: { revoked_count: res.meta.changes ?? 0 } });
});

// DELETE /auth/sessions/:id (登出單一裝置)
auth.delete('/sessions/:id', authMiddleware, async (c) => {
  await ensureOAuthSchema(c.env.DB);
  const userId = c.get('userId');
  const targetId = c.req.param('id');
  const now = Math.floor(Date.now() / 1000);

  const res = await c.env.DB.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL'
  )
    .bind(now, targetId, userId)
    .run();

  if (!res.meta.changes) {
    return c.json({ success: false, error: '找不到此裝置工作階段' }, 404);
  }
  return c.json({ success: true, data: { id: targetId } });
});

// POST /auth/password (修改密碼，並撤銷其他裝置與先前核發之 Legacy Token)
auth.post('/password', authMiddleware, async (c) => {
  await ensureOAuthSchema(c.env.DB);
  const userId = c.get('userId');
  const userEmail = c.get('userEmail').toLowerCase();
  const currentSid = c.get('sessionId');

  const { current_password, new_password } = await c.req.json<{
    current_password?: string;
    new_password?: string;
  }>();

  if (!current_password || !new_password) {
    return c.json({ success: false, error: '請填寫目前密碼與新密碼' }, 400);
  }
  if (new_password.length < 6) {
    return c.json({ success: false, error: '新密碼至少 6 個字元' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const ip = getClientIp(c);
  const emailKey = `email:${userEmail}`;
  const limitKeys = ip ? [emailKey, `ip:${ip}`] : [emailKey];

  if (await isRateLimited(c.env.DB, limitKeys, now)) {
    return c.json({ success: false, error: '嘗試次數過多，請於 15 分鐘後再試' }, 429);
  }

  const user = await c.env.DB.prepare('SELECT id, password_hash, salt FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; password_hash: string; salt: string }>();

  if (!user) {
    return c.json({ success: false, error: '帳號不存在' }, 404);
  }

  const { valid } = await verifyPassword(current_password, user.password_hash, user.salt);
  if (!valid) {
    await recordAuthFailure(c.env.DB, emailKey, ip, now);
    return c.json({ success: false, error: '目前密碼錯誤' }, 401);
  }

  await clearAuthFailures(c.env.DB, emailKey);

  const newSalt = generateSalt();
  const newHash = await hashPasswordPBKDF2(new_password, newSalt);

  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, salt = ?, legacy_token_valid_after = ? WHERE id = ?'
    ).bind(newHash, newSalt, now, userId),
    currentSid
      ? c.env.DB.prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL'
        ).bind(now, userId, currentSid)
      : c.env.DB.prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
        ).bind(now, userId),
  ]);

  return c.json({ success: true, data: { message: '密碼已更新，其他裝置已登出' } });
});

export default auth;
