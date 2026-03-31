import { Env } from '../types';

/** Base64url encode（不含 padding） */
function base64urlEncode(data: string | ArrayBuffer): string {
  const str =
    typeof data === 'string'
      ? btoa(data)
      : btoa(String.fromCharCode(...new Uint8Array(data)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url decode */
function base64urlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

/** 產生隨機 salt */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 用 SHA-256 + salt 雜湊密碼 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

/** 取得 HMAC key */
async function getHmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_SECRET || 'dev-secret-key-change-in-prod'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** 產生 JWT（HMAC-SHA256 簽章，base64url encoding） */
async function createToken(
  userId: string,
  email: string,
  env: Env
): Promise<string> {
  const header = base64urlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  const payload = base64urlEncode(
    JSON.stringify({
      sub: userId,
      email,
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })
  );

  const key = await getHmacKey(env);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  return `${header}.${payload}.${base64urlEncode(sig)}`;
}

/** 驗證 JWT 並回傳 payload */
export async function verifyToken(
  token: string,
  env: Env
): Promise<{ sub: string; email: string; exp: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    const key = await getHmacKey(env);

    const sigStr = base64urlDecode(signature);
    const sigBytes = Uint8Array.from(sigStr, (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (!valid) return null;

    const decoded = JSON.parse(base64urlDecode(payload));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

/** 產生 UUID */
function generateId(): string {
  return crypto.randomUUID();
}

/** POST /api/auth/register */
export async function handleRegister(
  body: { email: string; password: string; name: string },
  env: Env
): Promise<Response> {
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return Response.json(
      { ok: false, error: '請填寫所有欄位' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { ok: false, error: '密碼至少需要 6 個字元' },
      { status: 400 }
    );
  }

  // 檢查 email 是否已註冊
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    return Response.json(
      { ok: false, error: '此電子郵件已被註冊' },
      { status: 409 }
    );
  }

  const id = generateId();
  const salt = generateSalt();
  const hashed = await hashPassword(password, salt);

  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password, salt) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, email.toLowerCase(), name, hashed, salt)
    .run();

  const token = await createToken(id, email.toLowerCase(), env);

  return Response.json({
    ok: true,
    data: { user_id: id, email: email.toLowerCase(), name, token },
  });
}

/** POST /api/auth/login */
export async function handleLogin(
  body: { email: string; password: string },
  env: Env
): Promise<Response> {
  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      { ok: false, error: '請輸入電子郵件和密碼' },
      { status: 400 }
    );
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, password, salt FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first<{
      id: string;
      email: string;
      name: string;
      password: string;
      salt: string;
    }>();

  if (!user) {
    return Response.json(
      { ok: false, error: '帳號或密碼錯誤' },
      { status: 401 }
    );
  }

  const hashed = await hashPassword(password, user.salt);
  if (hashed !== user.password) {
    return Response.json(
      { ok: false, error: '帳號或密碼錯誤' },
      { status: 401 }
    );
  }

  const token = await createToken(user.id, user.email, env);

  return Response.json({
    ok: true,
    data: {
      user_id: user.id,
      email: user.email,
      name: user.name,
      token,
    },
  });
}
