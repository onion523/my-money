import { Hono } from 'hono';
import { Env } from '../types';
import { hashPassword, generateSalt, generateId, createJWT } from '../middleware/jwt';

const auth = new Hono<{ Bindings: Env }>();

// POST /auth/register
auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) return c.json({ success: false, error: '請填寫所有欄位' }, 400);
  if (password.length < 6) return c.json({ success: false, error: '密碼至少 6 個字元' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return c.json({ success: false, error: '此 Email 已被使用' }, 409);

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const id = generateId();

  await c.env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email.toLowerCase(), name, hash, salt).run();

  const token = await createJWT({ sub: id, email: email.toLowerCase(), name }, c.env.JWT_SECRET || 'dev-secret-key');
  return c.json({ success: true, data: { token, user: { id, email: email.toLowerCase(), name } } }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ success: false, error: '請填寫 Email 和密碼' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string; email: string; name: string; password_hash: string; salt: string }>();
  if (!user) return c.json({ success: false, error: 'Email 或密碼錯誤' }, 401);

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) return c.json({ success: false, error: 'Email 或密碼錯誤' }, 401);

  const token = await createJWT({ sub: user.id, email: user.email, name: user.name }, c.env.JWT_SECRET || 'dev-secret-key');
  return c.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
});

export default auth;
