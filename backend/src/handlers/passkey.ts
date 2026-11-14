import { Hono } from 'hono';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { Env } from '../types';
import { authMiddleware, base64urlDecode, base64urlEncode, createJWT, generateId } from '../middleware/jwt';

const CHALLENGE_TTL_SECONDS = 5 * 60;
const SUPPORTED_ALGS = [-7, -257]; // ES256, RS256

const passkeySchemaReady = new WeakSet<object>();

export async function ensurePasskeySchema(db: D1Database): Promise<void> {
  if (passkeySchemaReady.has(db as unknown as object)) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      name TEXT NOT NULL DEFAULT 'Passkey',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id)`,
    `CREATE TABLE IF NOT EXISTS webauthn_challenges (
      challenge TEXT PRIMARY KEY,
      purpose TEXT NOT NULL CHECK(purpose IN ('register', 'login')),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    )`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN webauthn_user_id TEXT').run();
  } catch {
    // 欄位已存在時忽略
  }
  try {
    await db.prepare('ALTER TABLE webauthn_challenges ADD COLUMN used_at INTEGER').run();
  } catch {
    // 欄位已存在時忽略
  }
  passkeySchemaReady.add(db as unknown as object);
}

export function getWebAuthnConfig(env: Env): { rpID: string; origin: string; rpName: string } {
  let rpID = env.WEBAUTHN_RP_ID;
  let origin = env.WEBAUTHN_ORIGIN;
  if (!rpID) {
    if (env.WEB_URL) {
      try {
        rpID = new URL(env.WEB_URL).hostname;
      } catch {
        rpID = 'localhost';
      }
    } else {
      rpID = 'localhost';
    }
  }
  if (!origin) {
    origin = env.WEB_URL ? env.WEB_URL.replace(/\/+$/, '') : 'http://localhost:5173';
  }
  return { rpID, origin, rpName: 'My Money' };
}

function randomHandle(byteLen = 24): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

function base64urlToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractChallengeFromClientData(clientDataJSON: string | undefined): string | null {
  if (!clientDataJSON) return null;
  try {
    const parsed = JSON.parse(base64urlDecode(clientDataJSON)) as { challenge?: string };
    return typeof parsed.challenge === 'string' && parsed.challenge ? parsed.challenge : null;
  } catch {
    return null;
  }
}

async function saveChallenge(
  db: D1Database,
  challenge: string,
  purpose: 'register' | 'login',
  userId: string | null,
  now: number
): Promise<void> {
  await db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').bind(now).run();
  await db
    .prepare(
      'INSERT INTO webauthn_challenges (challenge, purpose, user_id, expires_at) VALUES (?, ?, ?, ?)'
    )
    .bind(challenge, purpose, userId, now + CHALLENGE_TTL_SECONDS)
    .run();
}

async function consumeChallenge(
  db: D1Database,
  challenge: string,
  purpose: 'register' | 'login',
  userId: string | null,
  now: number
): Promise<boolean> {
  const sql =
    userId !== null
      ? 'UPDATE webauthn_challenges SET used_at = ? WHERE challenge = ? AND purpose = ? AND user_id = ? AND used_at IS NULL AND expires_at >= ?'
      : 'UPDATE webauthn_challenges SET used_at = ? WHERE challenge = ? AND purpose = ? AND user_id IS NULL AND used_at IS NULL AND expires_at >= ?';
  const res =
    userId !== null
      ? await db.prepare(sql).bind(now, challenge, purpose, userId, now).run()
      : await db.prepare(sql).bind(now, challenge, purpose, now).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function verifyPasskeyAssertion(
  db: D1Database,
  env: Env,
  response: AuthenticationResponseJSON | undefined
): Promise<{ ok: true; user: { id: string; email: string; name: string } } | { ok: false; error: string }> {
  await ensurePasskeySchema(db);
  if (!response || !response.id || !response.response?.clientDataJSON) {
    return { ok: false, error: '無效的 Passkey 驗證資料' };
  }

  const challenge = extractChallengeFromClientData(response.response.clientDataJSON);
  if (!challenge) {
    return { ok: false, error: 'Passkey challenge 格式無效' };
  }

  const now = Math.floor(Date.now() / 1000);
  const claimed = await consumeChallenge(db, challenge, 'login', null, now);
  if (!claimed) {
    return { ok: false, error: 'Passkey 驗證已過期或重複使用，請重試' };
  }

  const row = await db
    .prepare(
      `SELECT p.id AS pk_id, p.user_id, p.credential_id, p.public_key, p.sign_count, p.transports,
              u.email, u.name
       FROM passkeys p
       JOIN users u ON u.id = p.user_id
       WHERE p.credential_id = ?`
    )
    .bind(response.id)
    .first<{
      pk_id: string;
      user_id: string;
      credential_id: string;
      public_key: string;
      sign_count: number;
      transports: string | null;
      email: string;
      name: string;
    }>();

  if (!row) {
    return { ok: false, error: '找不到對應的 Passkey 憑證' };
  }

  const { rpID, origin } = getWebAuthnConfig(env);
  let transports: AuthenticatorTransport[] | undefined;
  if (row.transports) {
    try {
      transports = JSON.parse(row.transports) as AuthenticatorTransport[];
    } catch {
      transports = undefined;
    }
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: row.credential_id,
        publicKey: base64urlToUint8Array(row.public_key),
        counter: row.sign_count,
        transports,
      },
    });

    if (!verification.verified) {
      return { ok: false, error: 'Passkey 驗證失敗' };
    }

    const newCounter = verification.authenticationInfo.newCounter;
    // 防複製認證器：非零計數器若未遞增即拒絕；同步 Passkey（皆為 0）放行
    if (row.sign_count > 0 && newCounter <= row.sign_count) {
      return { ok: false, error: '偵測到異常的認證器計數器，請改用密碼登入並檢查 Passkey' };
    }

    await db
      .prepare('UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?')
      .bind(newCounter, now, row.pk_id)
      .run();

    return { ok: true, user: { id: row.user_id, email: row.email, name: row.name } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Passkey 驗證失敗';
    return { ok: false, error: msg };
  }
}

const passkey = new Hono<{
  Bindings: Env;
  Variables: { userId: string; userEmail: string; userName: string; sessionId?: string };
}>();

// POST /auth/passkey/register/options (需登入)
passkey.post('/passkey/register/options', authMiddleware, async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const userId = c.get('userId');

  const user = await c.env.DB.prepare('SELECT id, email, name, webauthn_user_id FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string; webauthn_user_id: string | null }>();
  if (!user) {
    return c.json({ success: false, error: '使用者不存在' }, 404);
  }

  let webauthnUserId = user.webauthn_user_id;
  if (!webauthnUserId) {
    webauthnUserId = randomHandle(24);
    await c.env.DB.prepare('UPDATE users SET webauthn_user_id = ? WHERE id = ?')
      .bind(webauthnUserId, userId)
      .run();
  }

  const existing = await c.env.DB.prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .all<{ credential_id: string; transports: string | null }>();

  const excludeCredentials = (existing.results || []).map((row) => {
    let transports: AuthenticatorTransport[] | undefined;
    if (row.transports) {
      try {
        transports = JSON.parse(row.transports) as AuthenticatorTransport[];
      } catch {
        transports = undefined;
      }
    }
    return { id: row.credential_id, transports };
  });

  const { rpID, rpName } = getWebAuthnConfig(c.env);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new Uint8Array(new TextEncoder().encode(webauthnUserId)),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
    supportedAlgorithmIDs: SUPPORTED_ALGS,
    excludeCredentials,
  });

  const now = Math.floor(Date.now() / 1000);
  await saveChallenge(c.env.DB, options.challenge, 'register', userId, now);

  return c.json({ success: true, data: options });
});

// POST /auth/passkey/register/verify (需登入)
passkey.post('/passkey/register/verify', authMiddleware, async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const userId = c.get('userId');
  const body = (await c.req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    name?: string;
  };

  if (!body.response?.id || !body.response?.response?.clientDataJSON) {
    return c.json({ success: false, error: '無效的 Passkey 註冊資料' }, 400);
  }

  const challenge = extractChallengeFromClientData(body.response.response.clientDataJSON);
  if (!challenge) {
    return c.json({ success: false, error: 'Passkey challenge 格式無效' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const claimed = await consumeChallenge(c.env.DB, challenge, 'register', userId, now);
  if (!claimed) {
    return c.json({ success: false, error: 'Passkey 註冊驗證已過期或重複使用，請重試' }, 400);
  }

  const { rpID, origin } = getWebAuthnConfig(c.env);
  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: SUPPORTED_ALGS,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ success: false, error: 'Passkey 註冊驗證失敗' }, 400);
    }

    const { credential } = verification.registrationInfo;
    const id = generateId();
    const name = (body.name || 'Passkey').trim().slice(0, 60) || 'Passkey';
    const transports = JSON.stringify(body.response.response.transports ?? credential.transports ?? []);

    await c.env.DB.prepare(
      `INSERT INTO passkeys (id, user_id, credential_id, public_key, sign_count, transports, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        userId,
        credential.id,
        base64urlEncode(credential.publicKey),
        credential.counter,
        transports,
        name,
        now
      )
      .run();

    return c.json(
      {
        success: true,
        data: { id, name, created_at: now, last_used_at: null },
      },
      201
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Passkey 註冊驗證失敗';
    return c.json({ success: false, error: msg }, 400);
  }
});

// POST /auth/passkey/login/options (公開)
passkey.post('/passkey/login/options', async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const { rpID } = getWebAuthnConfig(c.env);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: [],
  });
  const now = Math.floor(Date.now() / 1000);
  await saveChallenge(c.env.DB, options.challenge, 'login', null, now);
  return c.json({ success: true, data: options });
});

// POST /auth/passkey/login/verify (公開；iOS 過渡相容端點，受 LEGACY_AUTH_ENABLED 控制)
passkey.post('/passkey/login/verify', async (c) => {
  if (c.env.LEGACY_AUTH_ENABLED === 'false') {
    return c.json({ success: false, error: '舊版認證已停用，請改用 OAuth 登入' }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as { response?: AuthenticationResponseJSON };
  const result = await verifyPasskeyAssertion(c.env.DB, c.env, body.response);
  if (!result.ok) {
    return c.json({ success: false, error: result.error }, 401);
  }
  const token = await createJWT(
    { sub: result.user.id, email: result.user.email, name: result.user.name },
    c.env.JWT_SECRET || 'dev-secret-key'
  );
  return c.json({
    success: true,
    data: { token, user: result.user },
  });
});

// GET /auth/passkeys (需登入)
passkey.get('/passkeys', authMiddleware, async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT id, name, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(userId)
    .all<{ id: string; name: string; created_at: number; last_used_at: number | null }>();
  return c.json({ success: true, data: rows.results || [] });
});

// PATCH /auth/passkeys/:id (需登入，改名)
passkey.patch('/passkeys/:id', authMiddleware, async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || '').trim().slice(0, 60);
  if (!name) {
    return c.json({ success: false, error: '請輸入 Passkey 名稱' }, 400);
  }
  const res = await c.env.DB.prepare('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?')
    .bind(name, id, userId)
    .run();
  if (!res.meta.changes) {
    return c.json({ success: false, error: '找不到指定的 Passkey' }, 404);
  }
  return c.json({ success: true, data: { id, name } });
});

// DELETE /auth/passkeys/:id (需登入，僅停用該金鑰未來登入)
passkey.delete('/passkeys/:id', authMiddleware, async (c) => {
  await ensurePasskeySchema(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const res = await c.env.DB.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  if (!res.meta.changes) {
    return c.json({ success: false, error: '找不到指定的 Passkey' }, 404);
  }
  return c.json({ success: true, data: { deleted: true } });
});

export default passkey;
