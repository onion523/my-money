import type { Env } from '../types';
import {
  base64urlEncode,
  constantTimeEqual,
  generateId,
  generateSalt,
  hashPasswordPBKDF2,
} from '../middleware/jwt';

export const RESET_OTP_TTL_SECONDS = 10 * 60; // 10 分鐘
export const RESET_OTP_MAX_ATTEMPTS = 5;
export const RESET_EMAIL_COOLDOWN_SECONDS = 60;
export const RESET_RATE_WINDOW_SECONDS = 15 * 60; // 15 分鐘
export const RESET_EMAIL_MAX_REQUESTS = 3;
export const RESET_IP_MAX_REQUESTS = 10;

async function sha256Base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64urlEncode(new Uint8Array(digest));
}

function generateOtpCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      return (buf[0] % 1_000_000).toString().padStart(6, '0');
    }
  }
}

async function isKeyLocked(db: D1Database, key: string, now: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT locked_until FROM login_attempts WHERE attempt_key = ?')
    .bind(key)
    .first<{ locked_until: number | null }>();
  return Boolean(row?.locked_until && row.locked_until > now);
}

async function recordResetWindow(
  db: D1Database,
  key: string,
  maxRequests: number,
  cooldownSeconds: number,
  now: number
): Promise<void> {
  const existing = await db
    .prepare('SELECT failures, window_start FROM login_attempts WHERE attempt_key = ?')
    .bind(key)
    .first<{ failures: number; window_start: number }>();

  if (!existing || existing.window_start + RESET_RATE_WINDOW_SECONDS <= now) {
    const lockedUntil = cooldownSeconds > 0 ? now + cooldownSeconds : 1 >= maxRequests ? now + RESET_RATE_WINDOW_SECONDS : null;
    await db
      .prepare(
        `INSERT INTO login_attempts (attempt_key, failures, window_start, locked_until)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(attempt_key) DO UPDATE SET failures = 1, window_start = excluded.window_start, locked_until = excluded.locked_until`
      )
      .bind(key, now, lockedUntil)
      .run();
    return;
  }

  const nextCount = existing.failures + 1;
  let lockedUntil: number | null = null;
  if (nextCount >= maxRequests) {
    lockedUntil = existing.window_start + RESET_RATE_WINDOW_SECONDS;
  } else if (cooldownSeconds > 0) {
    lockedUntil = now + cooldownSeconds;
  }

  await db
    .prepare('UPDATE login_attempts SET failures = ?, locked_until = ? WHERE attempt_key = ?')
    .bind(nextCount, lockedUntil, key)
    .run();
}

async function checkAndConsumeResetRateLimit(
  db: D1Database,
  email: string,
  ip: string | null,
  now: number
): Promise<boolean> {
  const emailKey = `reset_email:${email}`;
  if (await isKeyLocked(db, emailKey, now)) return false;
  if (ip && (await isKeyLocked(db, `reset_ip:${ip}`, now))) return false;

  await recordResetWindow(db, emailKey, RESET_EMAIL_MAX_REQUESTS, RESET_EMAIL_COOLDOWN_SECONDS, now);
  if (ip) {
    await recordResetWindow(db, `reset_ip:${ip}`, RESET_IP_MAX_REQUESTS, 0, now);
  }
  return true;
}

async function sendOtpToBots(
  env: Env,
  bindings: Array<{ platform: string; platform_user_id: string }>,
  code: string
): Promise<void> {
  const text = `🔐 My Money 密碼重設驗證碼：${code}\n\n此驗證碼 10 分鐘內有效，請勿轉傳給他人。若非本人操作，請忽略此訊息。`;

  const tasks = bindings.map(async (b) => {
    if (b.platform === 'telegram' && env.TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: b.platform_user_id,
          text,
        }),
      });
    } else if (b.platform === 'line' && env.LINE_CHANNEL_ACCESS_TOKEN) {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: b.platform_user_id,
          messages: [{ type: 'text', text }],
        }),
      });
    }
  });

  await Promise.allSettled(tasks);
}

export async function requestPasswordResetOtp(
  db: D1Database,
  env: Env,
  email: string,
  ip: string | null,
  now: number
): Promise<{ status: 'ok' | 'rate_limited' }> {
  const allowed = await checkAndConsumeResetRateLimit(db, email, ip, now);
  if (!allowed) return { status: 'rate_limited' };

  const user = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (!user) return { status: 'ok' };

  const { results: bindings } = await db
    .prepare('SELECT platform, platform_user_id FROM bot_bindings WHERE user_id = ?')
    .bind(user.id)
    .all<{ platform: string; platform_user_id: string }>();

  if (!bindings || bindings.length === 0) {
    return { status: 'ok' };
  }

  const code = generateOtpCode();
  const codeHash = await sha256Base64url(`${user.id}:${code}`);

  await db
    .prepare('UPDATE password_reset_otps SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
    .bind(now, user.id)
    .run();

  await db
    .prepare(
      `INSERT INTO password_reset_otps (id, user_id, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .bind(generateId(), user.id, codeHash, now + RESET_OTP_TTL_SECONDS, now)
    .run();

  await sendOtpToBots(env, bindings, code);
  return { status: 'ok' };
}

export async function verifyAndResetPassword(
  db: D1Database,
  email: string,
  code: string,
  newPassword: string,
  now: number
): Promise<{ ok: true } | { ok: false; error: string; status: 400 }> {
  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false, error: '驗證碼錯誤或已失效', status: 400 };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: '密碼至少 6 個字元', status: 400 };
  }

  const user = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (!user) {
    return { ok: false, error: '驗證碼錯誤或已失效', status: 400 };
  }

  const otp = await db
    .prepare(
      `SELECT id, code_hash, expires_at, attempts
       FROM password_reset_otps
       WHERE user_id = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(user.id)
    .first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();

  if (!otp || otp.expires_at < now || otp.attempts >= RESET_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: '驗證碼錯誤或已失效', status: 400 };
  }

  const expectedHash = await sha256Base64url(`${user.id}:${code}`);
  if (!constantTimeEqual(expectedHash, otp.code_hash)) {
    const nextAttempts = otp.attempts + 1;
    const invalidatedAt = nextAttempts >= RESET_OTP_MAX_ATTEMPTS ? now : null;
    await db
      .prepare('UPDATE password_reset_otps SET attempts = ?, used_at = COALESCE(used_at, ?) WHERE id = ?')
      .bind(nextAttempts, invalidatedAt, otp.id)
      .run();
    return { ok: false, error: '驗證碼錯誤或已失效', status: 400 };
  }

  const claimOtp = await db
    .prepare('UPDATE password_reset_otps SET used_at = ? WHERE id = ? AND used_at IS NULL')
    .bind(now, otp.id)
    .run();
  if (!claimOtp.meta.changes) {
    return { ok: false, error: '驗證碼錯誤或已失效', status: 400 };
  }

  const newSalt = generateSalt();
  const newHash = await hashPasswordPBKDF2(newPassword, newSalt);

  await db
    .prepare('UPDATE users SET password_hash = ?, salt = ?, legacy_token_valid_after = ? WHERE id = ?')
    .bind(newHash, newSalt, now, user.id)
    .run();

  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .bind(now, user.id)
    .run();

  await db.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').bind(`email:${email}`).run();

  return { ok: true };
}
