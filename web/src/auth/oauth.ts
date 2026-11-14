import { useStore } from '../store/useStore';
import { clearDpopKey, createDpopProof, generateDpopKey, noteServerDate } from './dpop';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const AUTH_SERVER_BASE = ((import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

const REFRESH_TOKEN_KEY = 'mm_refresh_token';
const LEGACY_TOKEN_KEY = 'mm_token';
const USER_KEY = 'mm_user';
const PKCE_VERIFIER_KEY = 'mm_pkce_verifier';
const OAUTH_STATE_KEY = 'mm_oauth_state';

let memoryAccessToken: string | null = null;
let authScheme: 'Bearer' | 'DPoP' = 'Bearer';
let inFlightRefresh: Promise<string | null> | null = null;

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function setMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

/** 建立受保護 API 請求的驗證標頭；綁定金鑰的 Session 會附上 DPoP proof（RFC 9449） */
export async function buildAuthHeaders(method: string, path: string, token: string): Promise<Record<string, string>> {
  if (authScheme === 'DPoP') {
    const proof = await createDpopProof({ method, url: `${AUTH_SERVER_BASE}${path}`, accessToken: token });
    return { Authorization: `DPoP ${token}`, ...(proof ? { DPoP: proof } : {}) };
  }
  return { Authorization: `Bearer ${token}` };
}

/** 401 且為 DPoP proof 錯誤時，依伺服器 Date 校正本機時鐘；有調整時回傳 true，呼叫端可重試一次 */
export function adjustClockFromDpopError(res: Response): boolean {
  if (res.status !== 401) return false;
  const www = res.headers.get('WWW-Authenticate') || '';
  if (!www.includes('invalid_dpop_proof')) return false;
  return noteServerDate(res);
}

async function postToken(form: Record<string, string>): Promise<{ res: Response; data: any }> {
  const url = `${AUTH_SERVER_BASE}/oauth/token`;
  const send = async () => {
    const proof = await createDpopProof({ method: 'POST', url });
    return fetch(`${API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(proof ? { DPoP: proof } : {}) },
      body: new URLSearchParams(form).toString(),
    });
  };
  let res = await send();
  let data = await res.json().catch(() => ({}));
  // 時鐘誤差：依 Date 校正後自動重試一次（伺服器在 proof 驗證失敗時不會消費授權碼）
  if (!res.ok && data.error === 'invalid_dpop_proof' && noteServerDate(res)) {
    res = await send();
    data = await res.json().catch(() => ({}));
  }
  return { res, data };
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomBase64url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function computeCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function parseUserFromJwt(token: string): { id: string; email: string; name: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email || '', name: payload.name || '' };
  } catch {
    return null;
  }
}

function getRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

export async function startOAuthLogin(mode: 'login' | 'register' = 'login'): Promise<void> {
  const verifier = generateRandomBase64url(48);
  const challenge = await computeCodeChallenge(verifier);
  const state = generateRandomBase64url(24);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  // 每次登入產生新的 non-extractable 金鑰（不支援時退回未綁定 Bearer）
  await generateDpopKey();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'web',
    redirect_uri: getRedirectUri(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    scope: 'full',
  });
  if (mode === 'register') {
    params.set('mode', 'register');
  }
  window.location.assign(`${AUTH_SERVER_BASE}/oauth/authorize?${params.toString()}`);
}

function persistOAuthSession(
  accessToken: string,
  refreshToken: string,
  tokenType?: string
): { id: string; email: string; name: string } {
  const user = parseUserFromJwt(accessToken);
  if (!user) {
    throw new Error('無效的存取權杖');
  }
  authScheme = tokenType === 'DPoP' ? 'DPoP' : 'Bearer';
  if (authScheme === 'Bearer') {
    // 伺服器未綁定此 Session，本機金鑰沒有用途
    void clearDpopKey();
  }
  memoryAccessToken = accessToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  useStore.getState().setAuth(user, accessToken);
  return user;
}

export async function handleOAuthCallback(search: string): Promise<void> {
  const params = new URLSearchParams(search);
  const err = params.get('error');
  if (err) {
    await clearDpopKey();
    throw new Error(params.get('error_description') || err);
  }
  const code = params.get('code');
  const state = params.get('state');
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);

  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    await clearDpopKey();
    throw new Error('授權驗證狀態無效，請重新登入');
  }

  const { res, data } = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: 'web',
    code_verifier: verifier,
  });
  if (!res.ok || !data.access_token || !data.refresh_token) {
    await clearDpopKey();
    throw new Error(data.error_description || data.error || '換取權杖失敗');
  }

  persistOAuthSession(data.access_token, data.refresh_token, data.token_type);
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const { res, data } = await postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'web',
    });
    if (!res.ok || !data.access_token || !data.refresh_token) {
      clearAllAuth();
      return null;
    }

    persistOAuthSession(data.access_token, data.refresh_token, data.token_type);
    return data.access_token as string;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  const run = async (): Promise<string | null> => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request('mm_oauth_refresh', () => performRefresh());
    }
    return performRefresh();
  };

  inFlightRefresh = run().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export function clearAllAuth(): void {
  memoryAccessToken = null;
  authScheme = 'Bearer';
  void clearDpopKey();
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore storage errors
  }
  useStore.getState().logout();
}

export async function revokeAndLogout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  clearAllAuth();
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }).toString(),
      });
    } catch {
      // 撤銷失敗仍清除本機狀態
    }
  }
}

export async function bootstrapAuth(): Promise<void> {
  try {
    // 升級處理：發現舊版 mm_token 時一律清除並要求重新登入
    if (localStorage.getItem(LEGACY_TOKEN_KEY)) {
      clearAllAuth();
      return;
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined' && window.location.pathname === '/oauth/callback') {
    return;
  }

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (refreshToken && !memoryAccessToken) {
    await refreshAccessToken();
  }
}
