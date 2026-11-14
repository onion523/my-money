import { Hono, type Context } from 'hono';
import type { Env } from '../types';
import {
  base64urlDecode,
  base64urlEncode,
  constantTimeEqual,
  createJWT,
  generateId,
  generateSalt,
  hashPasswordPBKDF2,
  signHmac,
  verifyPassword,
} from '../middleware/jwt';
import { renderOAuthErrorPage, renderOAuthLoginPage } from './oauthLoginPage';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 分鐘
export const SESSION_IDLE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天
export const AUTH_CODE_TTL_SECONDS = 60; // 1 分鐘
export const REFRESH_GRACE_SECONDS = 30; // 30 秒輪替冪等緩衝
export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 分鐘
export const EMAIL_MAX_FAILURES = 5;
export const IP_MAX_FAILURES = 20;
const TX_COOKIE_NAME = 'mm_oauth_tx';
const TX_COOKIE_TTL_SECONDS = 10 * 60; // 10 分鐘

const initializedDbs = new WeakSet<object>();

export async function ensureOAuthSchema(db: D1Database): Promise<void> {
  if (initializedDbs.has(db as unknown as object)) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      dpop_jkt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      rotated_at INTEGER,
      replaced_by TEXT,
      grace_token_encrypted TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      attempt_key TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL,
      locked_until INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_session ON refresh_tokens(session_id)`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN legacy_token_valid_after INTEGER').run();
  } catch {
    // 欄位已存在時忽略
  }
  initializedDbs.add(db as unknown as object);
}

export function getAllowedRedirectUris(clientId: string, env: Env): string[] | null {
  if (clientId === 'ios') {
    return ['com.raychiu.mymoney:/oauth/callback'];
  }
  if (clientId === 'web') {
    const uris = new Set<string>();
    if (env.OAUTH_WEB_REDIRECT_URIS) {
      for (const raw of env.OAUTH_WEB_REDIRECT_URIS.split(',')) {
        const trimmed = raw.trim();
        if (trimmed) uris.add(trimmed);
      }
    }
    if (env.WEB_URL) {
      uris.add(`${env.WEB_URL.replace(/\/+$/, '')}/oauth/callback`);
    }
    if (env.ENVIRONMENT !== 'production') {
      uris.add('http://localhost:5173/oauth/callback');
      uris.add('http://127.0.0.1:5173/oauth/callback');
    }
    return Array.from(uris);
  }
  return null;
}

export function getClientDisplayName(clientId: string): string {
  if (clientId === 'web') return 'My Money Web';
  if (clientId === 'ios') return 'My Money iOS';
  return clientId;
}

export function parseDeviceName(ua?: string | null): string {
  if (!ua) return '未知裝置';
  if (ua.includes('MyMoney-iOS') || ua.includes('CFNetwork') || ua.includes('Darwin')) {
    if (ua.includes('iPad')) return 'iPad · My Money App';
    return 'iPhone · My Money App';
  }
  let browser = '瀏覽器';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  let os = '';
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return os ? `${browser} · ${os}` : browser;
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

export async function sha256Base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64urlEncode(new Uint8Array(digest));
}

function getSecret(env: Env): string {
  return env.JWT_SECRET || 'dev-secret-key';
}

export function getClientIp(c: Context): string | null {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || null;
}

export async function isRateLimited(db: D1Database, keys: string[], now: number): Promise<boolean> {
  for (const key of keys) {
    const row = await db
      .prepare('SELECT locked_until FROM login_attempts WHERE attempt_key = ?')
      .bind(key)
      .first<{ locked_until: number | null }>();
    if (row?.locked_until && row.locked_until > now) {
      return true;
    }
  }
  return false;
}

async function recordSingleFailure(db: D1Database, key: string, maxFailures: number, now: number): Promise<void> {
  const existing = await db
    .prepare('SELECT failures, window_start FROM login_attempts WHERE attempt_key = ?')
    .bind(key)
    .first<{ failures: number; window_start: number }>();

  if (!existing || existing.window_start + RATE_LIMIT_WINDOW_SECONDS <= now) {
    const lockedUntil = 1 >= maxFailures ? now + RATE_LIMIT_WINDOW_SECONDS : null;
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

  const nextFailures = existing.failures + 1;
  const lockedUntil = nextFailures >= maxFailures ? now + RATE_LIMIT_WINDOW_SECONDS : null;
  await db
    .prepare('UPDATE login_attempts SET failures = ?, locked_until = ? WHERE attempt_key = ?')
    .bind(nextFailures, lockedUntil, key)
    .run();
}

export async function recordAuthFailure(db: D1Database, emailKey: string, ip: string | null, now: number): Promise<void> {
  await recordSingleFailure(db, emailKey, EMAIL_MAX_FAILURES, now);
  if (ip) {
    await recordSingleFailure(db, `ip:${ip}`, IP_MAX_FAILURES, now);
  }
}

export async function clearAuthFailures(db: D1Database, emailKey: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').bind(emailKey).run();
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`grace:${secret}`));
  return crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function base64urlToBytes(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptGraceToken(token: string, secret: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  return `${base64urlEncode(iv)}.${base64urlEncode(new Uint8Array(ct))}`;
}

async function decryptGraceToken(encrypted: string, secret: string): Promise<string | null> {
  try {
    const [ivStr, ctStr] = encrypted.split('.');
    if (!ivStr || !ctStr) return null;
    const key = await deriveAesKey(secret);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64urlToBytes(ivStr) },
      key,
      base64urlToBytes(ctStr)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

interface TxCookiePayload {
  csrf: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string;
  scope: string;
  exp: number;
}

async function encodeTxCookie(payload: TxCookiePayload, secret: string): Promise<string> {
  const encoded = base64urlEncode(JSON.stringify(payload));
  const sig = await signHmac(encoded, secret);
  return `${encoded}.${sig}`;
}

async function decodeTxCookie(raw: string | undefined, secret: string): Promise<TxCookiePayload | null> {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = await signHmac(encoded, secret);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(base64urlDecode(encoded)) as TxCookiePayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

function buildCookieString(name: string, value: string, maxAge: number, reqUrl: string): string {
  const isHttps = reqUrl.startsWith('https://');
  return [
    `${name}=${value}`,
    'Path=/oauth/authorize',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(isHttps ? ['Secure'] : []),
  ].join('; ');
}

function applySecurityHeaders(c: Context) {
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  );
  c.header('X-Frame-Options', 'DENY');
  c.header('Cache-Control', 'no-store');
}

function redirectWithError(c: Context, redirectUri: string, error: string, description: string, state?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return c.redirect(url.toString(), 302);
}

function buildSwitchUrlBase(tx: Omit<TxCookiePayload, 'csrf' | 'exp'>): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: tx.client_id,
    redirect_uri: tx.redirect_uri,
    code_challenge: tx.code_challenge,
    code_challenge_method: 'S256',
    scope: tx.scope,
  });
  if (tx.state) p.set('state', tx.state);
  return `/oauth/authorize?${p.toString()}`;
}

function oauthError(c: Context, error: string, errorDescription: string, status: 400 | 401 = 400) {
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');
  return c.json({ error, error_description: errorDescription }, status);
}

const oauth = new Hono<{ Bindings: Env }>();

// GET /oauth/authorize
oauth.get('/authorize', async (c) => {
  await ensureOAuthSchema(c.env.DB);
  applySecurityHeaders(c);

  const clientId = c.req.query('client_id') || '';
  const redirectUri = c.req.query('redirect_uri') || '';
  const responseType = c.req.query('response_type') || '';
  const codeChallenge = c.req.query('code_challenge') || '';
  const codeChallengeMethod = c.req.query('code_challenge_method') || '';
  const state = c.req.query('state') || '';
  const scope = c.req.query('scope') || 'full';

  const allowedUris = getAllowedRedirectUris(clientId, c.env);
  if (!allowedUris || !redirectUri || !allowedUris.includes(redirectUri)) {
    return c.html(
      renderOAuthErrorPage('無效的授權請求', 'client_id 或 redirect_uri 未經允許，無法進行重導。'),
      400
    );
  }

  if (responseType !== 'code') {
    return redirectWithError(c, redirectUri, 'unsupported_response_type', '僅支援 response_type=code', state);
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return redirectWithError(c, redirectUri, 'invalid_request', '必須提供 PKCE code_challenge 與 S256', state);
  }
  if (scope !== 'full') {
    return redirectWithError(c, redirectUri, 'invalid_scope', '不支援的 scope', state);
  }

  const now = Math.floor(Date.now() / 1000);
  const csrf = randomToken(24);
  const txPayload: TxCookiePayload = {
    csrf,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state,
    scope,
    exp: now + TX_COOKIE_TTL_SECONDS,
  };
  const cookieVal = await encodeTxCookie(txPayload, getSecret(c.env));
  c.header('Set-Cookie', buildCookieString(TX_COOKIE_NAME, cookieVal, TX_COOKIE_TTL_SECONDS, c.req.url));

  const mode = c.req.query('mode') === 'register' ? 'register' : 'login';
  const html = renderOAuthLoginPage({
    csrfToken: csrf,
    mode,
    clientLabel: getClientDisplayName(clientId),
    switchUrlBase: buildSwitchUrlBase(txPayload),
  });
  return c.html(html, 200);
});

// POST /oauth/authorize
oauth.post('/authorize', async (c) => {
  await ensureOAuthSchema(c.env.DB);
  applySecurityHeaders(c);

  const secret = getSecret(c.env);
  const rawCookie = readCookie(c.req.header('Cookie'), TX_COOKIE_NAME);
  const tx = await decodeTxCookie(rawCookie, secret);
  if (!tx) {
    return c.html(renderOAuthErrorPage('登入階段已逾時', '請回到應用程式重新發起登入。'), 403);
  }

  const body = new URLSearchParams(await c.req.text());
  const csrfToken = body.get('csrf_token') || '';
  if (!csrfToken || !constantTimeEqual(csrfToken, tx.csrf)) {
    return c.html(renderOAuthErrorPage('CSRF 驗證失敗', '請回到應用程式重新發起登入。'), 403);
  }

  const mode = body.get('mode') === 'register' ? 'register' : 'login';
  const email = (body.get('email') || '').trim().toLowerCase();
  const password = body.get('password') || '';
  const name = (body.get('name') || '').trim();
  const switchUrlBase = buildSwitchUrlBase(tx);

  const renderFormError = (errorMsg: string, status: 400 | 401 | 409 | 429) =>
    c.html(
      renderOAuthLoginPage({
        csrfToken: tx.csrf,
        mode,
        email,
        name,
        error: errorMsg,
        clientLabel: getClientDisplayName(tx.client_id),
        switchUrlBase,
      }),
      status
    );

  let authenticatedUserId: string;

  if (mode === 'register') {
    if (!email || !password || !name) {
      return renderFormError('請填寫所有欄位', 400);
    }
    if (password.length < 6) {
      return renderFormError('密碼至少 6 個字元', 400);
    }
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (existing) {
      return renderFormError('此 Email 已被使用', 409);
    }
    const id = generateId();
    const salt = generateSalt();
    const hash = await hashPasswordPBKDF2(password, salt);
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(id, email, name, hash, salt)
      .run();
    authenticatedUserId = id;
  } else {
    if (!email || !password) {
      return renderFormError('請填寫 Email 和密碼', 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const ip = getClientIp(c);
    const emailKey = `email:${email}`;
    const limitKeys = ip ? [emailKey, `ip:${ip}`] : [emailKey];
    if (await isRateLimited(c.env.DB, limitKeys, now)) {
      return renderFormError('嘗試次數過多，請於 15 分鐘後再試', 429);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, name, password_hash, salt FROM users WHERE email = ?'
    )
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; salt: string }>();

    if (!user) {
      await recordAuthFailure(c.env.DB, emailKey, ip, now);
      return renderFormError('Email 或密碼錯誤', 401);
    }

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      await recordAuthFailure(c.env.DB, emailKey, ip, now);
      return renderFormError('Email 或密碼錯誤', 401);
    }

    await clearAuthFailures(c.env.DB, emailKey);

    if (needsRehash) {
      const newSalt = generateSalt();
      const newHash = await hashPasswordPBKDF2(password, newSalt);
      await c.env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
        .bind(newHash, newSalt, user.id)
        .run();
    }
    authenticatedUserId = user.id;
  }

  const now = Math.floor(Date.now() / 1000);
  const code = randomToken(32);
  const codeHash = await sha256Base64url(code);
  await c.env.DB.prepare(
    `INSERT INTO oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, scope, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(codeHash, authenticatedUserId, tx.client_id, tx.redirect_uri, tx.code_challenge, tx.scope, now + AUTH_CODE_TTL_SECONDS)
    .run();

  c.header('Set-Cookie', buildCookieString(TX_COOKIE_NAME, '', 0, c.req.url));
  const redirectUrl = new URL(tx.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (tx.state) redirectUrl.searchParams.set('state', tx.state);
  return c.redirect(redirectUrl.toString(), 302);
});

// POST /oauth/token
oauth.post('/token', async (c) => {
  await ensureOAuthSchema(c.env.DB);
  const body = new URLSearchParams(await c.req.text());
  const grantType = body.get('grant_type') || '';

  if (grantType === 'authorization_code') {
    const code = body.get('code') || '';
    const redirectUri = body.get('redirect_uri') || '';
    const clientId = body.get('client_id') || '';
    const codeVerifier = body.get('code_verifier') || '';

    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return oauthError(c, 'invalid_request', '缺少必要參數');
    }

    const allowedUris = getAllowedRedirectUris(clientId, c.env);
    if (!allowedUris) {
      return oauthError(c, 'invalid_client', '無效的 client_id', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const codeHash = await sha256Base64url(code);

    const claimResult = await c.env.DB.prepare(
      'UPDATE oauth_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL'
    )
      .bind(now, codeHash)
      .run();

    if (!claimResult.meta.changes) {
      return oauthError(c, 'invalid_grant', '授權碼無效或已被使用');
    }

    const codeRow = await c.env.DB.prepare(
      'SELECT user_id, client_id, redirect_uri, code_challenge, scope, expires_at FROM oauth_codes WHERE code_hash = ?'
    )
      .bind(codeHash)
      .first<{
        user_id: string;
        client_id: string;
        redirect_uri: string;
        code_challenge: string;
        scope: string;
        expires_at: number;
      }>();

    if (
      !codeRow ||
      codeRow.expires_at < now ||
      codeRow.client_id !== clientId ||
      codeRow.redirect_uri !== redirectUri
    ) {
      return oauthError(c, 'invalid_grant', '授權碼無效或已過期');
    }

    const computedChallenge = await sha256Base64url(codeVerifier);
    if (!constantTimeEqual(computedChallenge, codeRow.code_challenge)) {
      return oauthError(c, 'invalid_grant', 'PKCE 驗證失敗');
    }

    const user = await c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(codeRow.user_id)
      .first<{ id: string; email: string; name: string }>();
    if (!user) {
      return oauthError(c, 'invalid_grant', '使用者不存在');
    }

    const sessionId = generateId();
    const deviceName = parseDeviceName(c.req.header('User-Agent'));
    const refreshToken = randomToken(32);
    const refreshHash = await sha256Base64url(refreshToken);

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO sessions (id, user_id, client_id, device_name, created_at, last_used_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(sessionId, user.id, clientId, deviceName, now, now, now + SESSION_IDLE_TTL_SECONDS),
      c.env.DB.prepare(
        `INSERT INTO refresh_tokens (token_hash, session_id, created_at)
         VALUES (?, ?, ?)`
      ).bind(refreshHash, sessionId, now),
    ]);

    const accessToken = await createJWT(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        sid: sessionId,
        client_id: clientId,
        scope: codeRow.scope,
      },
      getSecret(c.env),
      ACCESS_TOKEN_TTL_SECONDS
    );

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: codeRow.scope,
    });
  }

  if (grantType === 'refresh_token') {
    const refreshToken = body.get('refresh_token') || '';
    const clientId = body.get('client_id') || '';

    if (!refreshToken || !clientId) {
      return oauthError(c, 'invalid_request', '缺少必要參數');
    }
    if (!getAllowedRedirectUris(clientId, c.env)) {
      return oauthError(c, 'invalid_client', '無效的 client_id', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenHash = await sha256Base64url(refreshToken);

    const row = await c.env.DB.prepare(
      `SELECT rt.token_hash, rt.session_id, rt.rotated_at, rt.grace_token_encrypted,
              s.user_id, s.client_id, s.expires_at, s.revoked_at,
              u.email, u.name
       FROM refresh_tokens rt
       JOIN sessions s ON s.id = rt.session_id
       JOIN users u ON u.id = s.user_id
       WHERE rt.token_hash = ?`
    )
      .bind(tokenHash)
      .first<{
        token_hash: string;
        session_id: string;
        rotated_at: number | null;
        grace_token_encrypted: string | null;
        user_id: string;
        client_id: string;
        expires_at: number;
        revoked_at: number | null;
        email: string;
        name: string;
      }>();

    if (!row || row.client_id !== clientId || row.revoked_at !== null || row.expires_at < now) {
      return oauthError(c, 'invalid_grant', 'Refresh Token 無效或已過期');
    }

    const secret = getSecret(c.env);
    let nextRefreshToken: string | null = null;

    if (row.rotated_at === null) {
      const candidateToken = randomToken(32);
      const candidateHash = await sha256Base64url(candidateToken);
      const encryptedGrace = await encryptGraceToken(candidateToken, secret);

      const claim = await c.env.DB.prepare(
        `UPDATE refresh_tokens
         SET rotated_at = ?, replaced_by = ?, grace_token_encrypted = ?
         WHERE token_hash = ? AND rotated_at IS NULL`
      )
        .bind(now, candidateHash, encryptedGrace, tokenHash)
        .run();

      if (claim.meta.changes === 1) {
        await c.env.DB.batch([
          c.env.DB.prepare(
            'INSERT INTO refresh_tokens (token_hash, session_id, created_at) VALUES (?, ?, ?)'
          ).bind(candidateHash, row.session_id, now),
          c.env.DB.prepare(
            'UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?'
          ).bind(now, now + SESSION_IDLE_TTL_SECONDS, row.session_id),
        ]);
        nextRefreshToken = candidateToken;
      } else {
        // 併發請求搶先輪替，改讀已寫入的緩衝資料
        const latest = await c.env.DB.prepare(
          'SELECT rotated_at, grace_token_encrypted FROM refresh_tokens WHERE token_hash = ?'
        )
          .bind(tokenHash)
          .first<{ rotated_at: number | null; grace_token_encrypted: string | null }>();
        if (latest?.rotated_at !== null && latest?.rotated_at !== undefined && now - latest.rotated_at <= REFRESH_GRACE_SECONDS && latest.grace_token_encrypted) {
          nextRefreshToken = await decryptGraceToken(latest.grace_token_encrypted, secret);
        }
      }
    } else if (now - row.rotated_at <= REFRESH_GRACE_SECONDS && row.grace_token_encrypted) {
      nextRefreshToken = await decryptGraceToken(row.grace_token_encrypted, secret);
    } else {
      // 超過緩衝期的舊 token 重用：撤銷整個 Session
      await c.env.DB.prepare(
        'UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'
      )
        .bind(now, row.session_id)
        .run();
      return oauthError(c, 'invalid_grant', 'Refresh Token 已被重複使用，工作階段已撤銷');
    }

    if (!nextRefreshToken) {
      return oauthError(c, 'invalid_grant', 'Refresh Token 無法更新');
    }

    const accessToken = await createJWT(
      {
        sub: row.user_id,
        email: row.email,
        name: row.name,
        sid: row.session_id,
        client_id: clientId,
        scope: 'full',
      },
      secret,
      ACCESS_TOKEN_TTL_SECONDS
    );

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: nextRefreshToken,
      scope: 'full',
    });
  }

  return oauthError(c, 'unsupported_grant_type', '不支援的 grant_type');
});

// POST /oauth/revoke (RFC 7009)
oauth.post('/revoke', async (c) => {
  await ensureOAuthSchema(c.env.DB);
  const body = new URLSearchParams(await c.req.text());
  const token = body.get('token') || '';
  if (token) {
    const tokenHash = await sha256Base64url(token);
    const rt = await c.env.DB.prepare('SELECT session_id FROM refresh_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{ session_id: string }>();
    if (rt) {
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
        .bind(now, rt.session_id)
        .run();
    }
  }
  c.header('Cache-Control', 'no-store');
  return c.json({ success: true }, 200);
});

export function buildOAuthMetadata(reqUrl: string) {
  const issuer = new URL(reqUrl).origin;
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['full'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export default oauth;
