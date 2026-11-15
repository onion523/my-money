import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
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
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let listenersInitialized = false;

export function hasRefreshToken(): boolean {
  try {
    return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY));
  } catch {
    return false;
  }
}

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string | null, bufferSec = 120): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (!exp) return false;
  return Math.floor(Date.now() / 1000) >= exp - bufferSec;
}

function scheduleProactiveRefresh(accessToken: string): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const payload = decodeJwtPayload(accessToken);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (!exp) return;

  const delayMs = Math.max(5000, (exp - 60) * 1000 - Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void refreshAccessToken();
    }
  }, delayMs);
}

export function parseUserFromJwt(token: string): { id: string; email: string; name: string } | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== 'string' || !payload.sub) return null;
  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
  };
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
  scheduleProactiveRefresh(accessToken);
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

/** 以 Passkey（WebAuthn）登入並透過 /oauth/passkey/authorize 橋接取得 DPoP-bound OAuth Session */
export async function loginWithPasskey(): Promise<void> {
  if (!browserSupportsWebAuthn()) {
    throw new Error('此瀏覽器或裝置不支援 Passkey');
  }

  const optRes = await fetch(`${API_BASE}/auth/passkey/login/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const optJson = await optRes.json().catch(() => ({}));
  if (!optRes.ok || !optJson.success || !optJson.data) {
    throw new Error(optJson.error || '無法取得 Passkey 驗證資訊');
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: optJson.data });
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new Error('已取消 Passkey 驗證，請重試或改用密碼登入');
    }
    throw new Error(err instanceof Error ? err.message : 'Passkey 驗證失敗');
  }

  const verifier = generateRandomBase64url(48);
  const challenge = await computeCodeChallenge(verifier);
  const state = generateRandomBase64url(24);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  await generateDpopKey();

  try {
    const authRes = await fetch(`${API_BASE}/oauth/passkey/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: assertion,
        client_id: 'web',
        redirect_uri: getRedirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        scope: 'full',
      }),
    });
    const authJson = await authRes.json().catch(() => ({}));
    if (!authRes.ok || !authJson.success || !authJson.data?.code) {
      throw new Error(authJson.error || 'Passkey 登入失敗，請改用密碼登入');
    }

    await handleOAuthCallback(
      `?code=${encodeURIComponent(authJson.data.code)}&state=${encodeURIComponent(authJson.data.state || state)}`
    );
  } catch (err) {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    await clearDpopKey();
    throw err;
  }
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { res, data } = await postToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'web',
      });
      if (res.ok && data.access_token && data.refresh_token) {
        persistOAuthSession(data.access_token, data.refresh_token, data.token_type);
        return data.access_token as string;
      }

      // 400/401 代表伺服器明確拒絕（如 Refresh Token 失效/被撤銷或金鑰不符），才清除本機登入狀態
      if (res.status === 400 || res.status === 401) {
        clearAllAuth();
        return null;
      }

      // 5xx / 429 屬於暫時性錯誤，短暫重試一次，失敗時保留 refresh token 不強制登出
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // 網路中斷或裝置剛喚醒，短暫重試一次，失敗時保留 refresh token 不強制登出
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  return null;
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
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
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

function initAuthListeners(): void {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  const refreshIfNeeded = () => {
    if (!hasRefreshToken()) return;
    if (!memoryAccessToken || isTokenExpiringSoon(memoryAccessToken, 120)) {
      void refreshAccessToken();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshIfNeeded();
    }
  });
  window.addEventListener('online', refreshIfNeeded);
  window.addEventListener('storage', (e) => {
    if (e.key === REFRESH_TOKEN_KEY && e.newValue === null && memoryAccessToken) {
      clearAllAuth();
    }
  });
}

export async function bootstrapAuth(): Promise<void> {
  initAuthListeners();

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
