// DPoP（RFC 9449）：金鑰為 non-extractable ES256，存於 IndexedDB；每個請求以私鑰簽出短效 proof
const DB_NAME = 'mm_dpop';
const STORE = 'keys';
const KEY_ID = 'session';

interface StoredKey {
  privateKey: CryptoKey;
  jwk: { kty: string; crv: string; x: string; y: string };
}

let cachedKey: StoredKey | null = null;
let clockOffsetSec = 0;

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function isDpopSupported(): boolean {
  return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
}

/** 產生新的不可匯出金鑰並存入 IndexedDB；失敗（不支援）時回傳 false，client 退回未綁定 Bearer */
export async function generateDpopKey(): Promise<boolean> {
  if (!isDpopSupported()) return false;
  try {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const stored: StoredKey = {
      privateKey: pair.privateKey,
      jwk: { kty: jwk.kty!, crv: jwk.crv!, x: jwk.x!, y: jwk.y! },
    };
    await idbRun('readwrite', (s) => s.put(stored, KEY_ID));
    cachedKey = stored;
    return true;
  } catch {
    cachedKey = null;
    return false;
  }
}

async function loadKey(): Promise<StoredKey | null> {
  if (cachedKey) return cachedKey;
  if (!isDpopSupported()) return null;
  try {
    const stored = (await idbRun('readonly', (s) => s.get(KEY_ID))) as StoredKey | undefined;
    cachedKey = stored ?? null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

export async function hasDpopKey(): Promise<boolean> {
  return (await loadKey()) !== null;
}

export async function clearDpopKey(): Promise<void> {
  cachedKey = null;
  if (!isDpopSupported()) return;
  try {
    await idbRun('readwrite', (s) => s.delete(KEY_ID));
  } catch {
    // ignore
  }
}

/** 依伺服器回應 Date header 估算本機時鐘差（秒） */
export function noteServerDate(res: Response): boolean {
  const date = res.headers.get('Date') || res.headers.get('date');
  if (!date) return false;
  const serverSec = Math.floor(new Date(date).getTime() / 1000);
  if (!Number.isFinite(serverSec)) return false;
  const next = serverSec - Math.floor(Date.now() / 1000);
  const changed = Math.abs(next - clockOffsetSec) > 1;
  clockOffsetSec = next;
  return changed;
}

/** 產生 proof；沒有金鑰時回傳 null。url 必須是伺服器看到的絕對網址（不含 query / fragment 也可，伺服器會忽略） */
export async function createDpopProof(opts: { method: string; url: string; accessToken?: string }): Promise<string | null> {
  const key = await loadKey();
  if (!key) return null;
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: key.jwk };
  const payload: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: opts.method.toUpperCase(),
    htu: opts.url.split('#')[0].split('?')[0],
    iat: Math.floor(Date.now() / 1000) + clockOffsetSec,
  };
  if (opts.accessToken) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(opts.accessToken));
    payload.ath = b64url(digest);
  }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}
