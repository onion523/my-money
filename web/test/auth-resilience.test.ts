import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapAuth,
  clearAllAuth,
  getMemoryAccessToken,
  hasRefreshToken,
  refreshAccessToken,
  setMemoryAccessToken,
} from '../src/auth/oauth';
import { accountsApi } from '../src/api/client';
import { useStore } from '../src/store/useStore';

function makeJwt(expOffsetSec = 900): string {
  const encode = (obj: unknown) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    exp: now + expOffsetSec,
  })}.sig`;
}

describe('Web Auth Transient Refresh Resilience', () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearAllAuth();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/', href: 'http://localhost:5173/' },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    clearAllAuth();
  });

  it('retries once on network error and preserves refresh token when still failing', async () => {
    localStorage.setItem('mm_refresh_token', 'rt-initial');
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hasRefreshToken()).toBe(true);
    expect(localStorage.getItem('mm_refresh_token')).toBe('rt-initial');
  });

  it('preserves refresh token on 503 transient server error after retry', async () => {
    localStorage.setItem('mm_refresh_token', 'rt-initial');
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hasRefreshToken()).toBe(true);
  });

  it('recovers when retry after transient failure succeeds', async () => {
    localStorage.setItem('mm_refresh_token', 'rt-initial');
    const nextJwt = makeJwt(900);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('NetworkError'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: nextJwt,
            refresh_token: 'rt-rotated',
            token_type: 'Bearer',
          }),
          { status: 200 }
        )
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const token = await refreshAccessToken();

    expect(token).toBe(nextJwt);
    expect(getMemoryAccessToken()).toBe(nextJwt);
    expect(localStorage.getItem('mm_refresh_token')).toBe('rt-rotated');
    expect(useStore.getState().token).toBe(nextJwt);
  });

  it('clears auth immediately on definitive 400 invalid_grant rejection', async () => {
    localStorage.setItem('mm_refresh_token', 'rt-revoked');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hasRefreshToken()).toBe(false);
    expect(useStore.getState().token).toBeNull();
  });

  it('does not redirect to /login or wipe refresh token when API 401 refresh fails transiently', async () => {
    const expiredJwt = makeJwt(-10);
    setMemoryAccessToken(expiredJwt);
    localStorage.setItem('mm_refresh_token', 'rt-valid');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/oauth/token')) {
        throw new TypeError('Offline');
      }
      return new Response(JSON.stringify({ success: false, error: 'Token 無效或已過期' }), {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(accountsApi.list()).rejects.toThrow('連線暫時中斷');
    expect(hasRefreshToken()).toBe(true);
    expect(window.location.href).toBe('http://localhost:5173/');
  });

  it('redirects to /login when API 401 refresh receives 400 invalid_grant', async () => {
    const expiredJwt = makeJwt(-10);
    setMemoryAccessToken(expiredJwt);
    localStorage.setItem('mm_refresh_token', 'rt-revoked');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/oauth/token')) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      }
      return new Response(JSON.stringify({ success: false, error: 'Token 無效或已過期' }), {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(accountsApi.list()).rejects.toThrow();
    expect(hasRefreshToken()).toBe(false);
    expect(window.location.href).toBe('/login');
  });

  it('syncs cross-tab logout on storage event and refreshes on online event', async () => {
    const freshJwt = makeJwt(900);
    localStorage.setItem('mm_refresh_token', 'rt-tab');
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: freshJwt,
            refresh_token: 'rt-tab-2',
            token_type: 'Bearer',
          }),
          { status: 200 }
        )
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await bootstrapAuth();
    expect(getMemoryAccessToken()).toBe(freshJwt);

    // Simulate another tab logging out
    localStorage.removeItem('mm_refresh_token');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'mm_refresh_token',
        newValue: null,
        oldValue: 'rt-tab-2',
      })
    );
    expect(getMemoryAccessToken()).toBeNull();
    expect(useStore.getState().token).toBeNull();

    // Simulate online recovery when refresh token exists
    localStorage.setItem('mm_refresh_token', 'rt-online');
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => {
      expect(getMemoryAccessToken()).toBe(freshJwt);
    });
  });
});
