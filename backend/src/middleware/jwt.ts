import type { Context, Next } from 'hono';
import type { Env, JWTPayload } from '../types';

// Base64URL 編碼 (支援 UTF-8 字串及 Uint8Array)
export function base64urlEncode(data: string | Uint8Array): string {
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

export function base64urlDecode(str: string): string {
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
export async function signHmac(payload: string, secret: string): Promise<string> {
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

export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(fullPayload));
  const signature = await signHmac(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expected = await signHmac(`${header}.${body}`, secret);
    if (!constantTimeEqual(expected, signature)) return null;
    const payload: JWTPayload = JSON.parse(base64urlDecode(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const PBKDF2_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return new TextEncoder().encode(hex);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// 舊版 SHA-256 密碼雜湊（僅供舊帳號驗證與遷移使用）
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}

async function derivePBKDF2Hex(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

// 新版 PBKDF2-SHA256 密碼雜湊（帶版本與迭代次數前綴）
export async function hashPasswordPBKDF2(password: string, salt: string): Promise<string> {
  const hex = await derivePBKDF2Hex(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${hex}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const iterations = Number(parts[1]);
    const expectedHex = parts[2];
    if (!Number.isFinite(iterations) || iterations <= 0 || !expectedHex) {
      return { valid: false, needsRehash: false };
    }
    const derived = await derivePBKDF2Hex(password, salt, iterations);
    const valid = constantTimeEqual(derived, expectedHex);
    return { valid, needsRehash: valid && iterations < PBKDF2_ITERATIONS };
  }

  const legacy = await hashPassword(password, salt);
  const valid = constantTimeEqual(legacy, storedHash);
  return { valid, needsRehash: valid };
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

function unauthorized(c: Context, message: string) {
  c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
  return c.json({ success: false, error: message }, 401);
}

// JWT 認證中介層（新格式 OAuth Access Token 僅接受 Authorization header；相容期間 Legacy Token 支援 header 與 ?token=）
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { userId: string; userEmail: string; userName: string; sessionId?: string } }>,
  next: Next
) {
  const auth = c.req.header('Authorization');
  const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const queryToken = c.req.query('token');
  const token = bearerToken || queryToken;
  const fromQuery = !bearerToken && Boolean(queryToken);
  if (!token) {
    return unauthorized(c, '未授權，請先登入');
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'dev-secret-key');
  if (!payload) {
    return unauthorized(c, 'Token 無效或已過期');
  }
  if (payload.sid && fromQuery) {
    return unauthorized(c, 'Access Token 不可透過網址參數傳遞');
  }
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userName', payload.name);
  if (payload.sid) {
    c.set('sessionId', payload.sid);
  }
  await next();
}