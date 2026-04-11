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

/** POST /api/auth/register
 *
 * 註冊流程:
 *   1. 建立 user
 *   2. 自動建立個人帳本「我的帳本」(owner = 該 user)
 *   3. 加入 book_members (role = owner)
 *   4. 寫 user_settings (active_book_id = 個人帳本)
 *   5. 簽 JWT 回傳
 */
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

  const userId = generateId();
  const salt = generateSalt();
  const hashed = await hashPassword(password, salt);
  const bookId = generateId();
  const now = new Date().toISOString();

  // Batch insert: user + book + book_members + user_settings
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, name, password, salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email.toLowerCase(), name, hashed, salt, now, now),

    env.DB.prepare(
      'INSERT INTO books (id, name, emoji, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(bookId, '我的帳本', '📒', userId, now, now),

    env.DB.prepare(
      'INSERT INTO book_members (book_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).bind(bookId, userId, 'owner', now),

    env.DB.prepare(
      'INSERT INTO user_settings (user_id, active_book_id, updated_at) VALUES (?, ?, ?)'
    ).bind(userId, bookId, now),
  ]);

  const token = await createToken(userId, email.toLowerCase(), env);

  return Response.json({
    ok: true,
    data: {
      user_id: userId,
      email: email.toLowerCase(),
      name,
      token,
      active_book_id: bookId,
    },
  });
}

/** GET /api/auth/me
 *
 * 回傳當前使用者資訊 + active_book + role + 所屬的所有 books
 */
export async function handleMe(
  userId: string,
  env: Env
): Promise<Response> {
  const user = await env.DB.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first<{ id: string; email: string; name: string; created_at: string }>();

  if (!user) {
    return Response.json(
      { ok: false, error: '使用者不存在' },
      { status: 404 }
    );
  }

  // 拿所有所屬 books + role
  const { results: books } = await env.DB.prepare(
    `SELECT b.id, b.name, b.emoji, b.owner_user_id, bm.role, b.created_at, b.updated_at
     FROM books b
     INNER JOIN book_members bm ON bm.book_id = b.id
     WHERE bm.user_id = ?
     ORDER BY bm.joined_at ASC`
  )
    .bind(userId)
    .all();

  // 拿 active_book_id (若沒有 settings 用第一本作為 fallback)
  const settings = await env.DB.prepare(
    'SELECT active_book_id FROM user_settings WHERE user_id = ?'
  )
    .bind(userId)
    .first<{ active_book_id: string | null }>();

  let activeBookId = settings?.active_book_id ?? null;
  // 若 active_book_id 不在 books 列表中 (被踢) → 用第一本
  if (activeBookId && !books.find((b: any) => b.id === activeBookId)) {
    activeBookId = (books[0] as any)?.id ?? null;
  }
  if (!activeBookId && books.length > 0) {
    activeBookId = (books[0] as any).id;
  }

  // 找 active book 的 role
  const activeBook = books.find((b: any) => b.id === activeBookId) as any;

  return Response.json({
    ok: true,
    data: {
      user,
      books,
      active_book_id: activeBookId,
      active_book: activeBook ?? null,
      role: activeBook?.role ?? null,
    },
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
