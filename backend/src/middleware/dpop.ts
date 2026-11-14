import { base64urlDecode, base64urlEncode } from './jwt';

export const DPOP_IAT_TOLERANCE_SECONDS = 60;
export const DPOP_JTI_TTL_SECONDS = 120;

export type DpopResult =
  | { ok: true; jkt: string; jti: string }
  | { ok: false; error: string; clockSkew?: boolean };

interface EcJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  [k: string]: unknown;
}

function base64urlToBytes(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

/** RFC 7638 JWK SHA-256 thumbprint（EC 公鑰） */
export async function jwkThumbprint(jwk: Pick<EcJwk, 'crv' | 'kty' | 'x' | 'y'>): Promise<string> {
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  return base64urlEncode(await sha256Bytes(canonical));
}

/** RFC 9449 §4.2 ath：base64url(SHA-256(access token)) */
export async function accessTokenHash(accessToken: string): Promise<string> {
  return base64urlEncode(await sha256Bytes(accessToken));
}

/** htu 比對：忽略 query 與 fragment */
function normalizeHtu(raw: string): string | null {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

export interface VerifyDpopOptions {
  proof: string | undefined | null;
  method: string;
  url: string;
  accessToken?: string;
  now?: number;
}

/** 驗證 DPoP proof（不含 jti 去重，去重由 claimDpopJti 負責） */
export async function verifyDpopProof(opts: VerifyDpopOptions): Promise<DpopResult> {
  const fail = (error: string, clockSkew = false): DpopResult => ({ ok: false, error, clockSkew });
  const { proof } = opts;
  if (!proof) return fail('缺少 DPoP proof');

  const parts = proof.split('.');
  if (parts.length !== 3) return fail('DPoP proof 格式錯誤');
  const [h, p, s] = parts;

  let header: { typ?: string; alg?: string; jwk?: EcJwk };
  let payload: { jti?: string; htm?: string; htu?: string; iat?: number; ath?: string };
  try {
    header = JSON.parse(base64urlDecode(h));
    payload = JSON.parse(base64urlDecode(p));
  } catch {
    return fail('DPoP proof 無法解析');
  }

  if (header.typ !== 'dpop+jwt') return fail('DPoP proof typ 必須為 dpop+jwt');
  if (header.alg !== 'ES256') return fail('DPoP proof 僅接受 ES256');
  const jwk = header.jwk;
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    return fail('DPoP proof jwk 無效');
  }
  if ('d' in jwk || 'p' in jwk || 'q' in jwk || 'k' in jwk) {
    return fail('DPoP proof jwk 不可包含私鑰欄位');
  }

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
  } catch {
    return fail('DPoP proof 簽章驗證失敗');
  }
  if (!valid) return fail('DPoP proof 簽章驗證失敗');

  if (typeof payload.jti !== 'string' || !payload.jti) return fail('DPoP proof 缺少 jti');
  if (payload.htm !== opts.method.toUpperCase()) return fail('DPoP proof htm 不符');
  const htu = payload.htu ? normalizeHtu(payload.htu) : null;
  const expectedHtu = normalizeHtu(opts.url);
  if (!htu || htu !== expectedHtu) return fail('DPoP proof htu 不符');

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== 'number' || Math.abs(now - payload.iat) > DPOP_IAT_TOLERANCE_SECONDS) {
    return fail('DPoP proof iat 超出允許範圍', true);
  }

  if (opts.accessToken !== undefined) {
    const expectedAth = await accessTokenHash(opts.accessToken);
    if (payload.ath !== expectedAth) return fail('DPoP proof ath 不符');
  }

  return { ok: true, jkt: await jwkThumbprint(jwk), jti: payload.jti };
}

const dpopSchemaReady = new WeakSet<object>();

export async function ensureDpopSchema(db: D1Database): Promise<void> {
  if (dpopSchemaReady.has(db as unknown as object)) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS dpop_jti (
        jti TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      )`
    )
    .run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_dpop_jti_exp ON dpop_jti(expires_at)').run();
  dpopSchemaReady.add(db as unknown as object);
}

/** 領取 jti；已被使用過回傳 false（唯一鍵衝突） */
export async function claimDpopJti(db: D1Database, jti: string, now: number): Promise<boolean> {
  await ensureDpopSchema(db);
  await db.prepare('DELETE FROM dpop_jti WHERE expires_at < ?').bind(now).run();
  try {
    await db
      .prepare('INSERT INTO dpop_jti (jti, expires_at) VALUES (?, ?)')
      .bind(jti, now + DPOP_JTI_TTL_SECONDS)
      .run();
    return true;
  } catch {
    return false;
  }
}
