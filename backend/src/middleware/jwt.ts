import { Context, Next } from 'hono';
import { Env, JWTPayload } from '../types';

// Base64URL 編碼 (支援 UTF-8 字串及 Uint8Array)
function base64urlEncode(data: string | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// HMAC-SHA256 簽署
async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64urlEncode(new Uint8Array(sig));
}

export async function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 30 };
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(fullPayload));
  const signature = await sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [header, body, signature] = token.split('.');
    const expected = await sign(`${header}.${body}`, secret);
    if (expected !== signature) return null;
    const payload: JWTPayload = JSON.parse(base64urlDecode(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// SHA-256 密碼雜湊
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 產生隨機 salt
export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// UUID v4
export function generateId(): string {
  return crypto.randomUUID();
}

// JWT 認證中介層（支援 Header Authorization 或 URL query param token）
export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { userId: string; userEmail: string; userName: string } }>, next: Next) {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : c.req.query('token');
  if (!token) {
    return c.json({ success: false, error: '未授權，請先登入' }, 401);
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'dev-secret-key');
  if (!payload) {
    return c.json({ success: false, error: 'Token 無效或已過期' }, 401);
  }
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userName', payload.name);
  await next();
}