import { useStore } from '../store/useStore';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const AUTH_SERVER_BASE = ((import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

const REFRESH_TOKEN_KEY = 'mm_refresh_token';
const LEGACY_TOKEN_KEY = 'mm_token';
const USER_KEY = 'mm_user';
const PKCE_VERIFIER_KEY = 'mm_pkce_verifier';
const OAUTH_STATE_KEY = 'mm_oauth_state';

let memoryAccessToken: string | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function setMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token;
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

function persistOAuthSession(accessToken: string, refreshToken: string): { id: string; email: string; name: string } {
  const user = parseUserFromJwt(accessToken);
  if (!user) {
    throw new Error('無效的存取權杖');
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
    throw new Error(params.get('error_description') || err);
  }
  const code = params.get('code');
  const state = params.get('state');
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);

  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    throw new Error('授權驗證狀態無效，請重新登入');
  }

  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: 'web',
      code_verifier: verifier,
    }).toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || '換取權杖失敗');
  }

  persistOAuthSession(data.access_token, data.refresh_token);
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'web',
      }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.refresh_token) {
      clearAllAuth();
      return null;
    }

    persistOAuthSession(data.access_token, data.refresh_token);
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
