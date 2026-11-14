import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { createHarness, FIXED_NOW, type Harness } from './harness';
import { hashPassword } from '../src/middleware/jwt';

async function sha256Base64url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let binary = '';
  for (const b of new Uint8Array(digest)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractCsrfToken(html: string): string {
  const m = html.match(/name="csrf_token"\s+value="([^"]+)"/);
  if (!m) throw new Error('csrf_token not found in HTML');
  return m[1];
}

function extractSetCookie(headers: Headers, name: string): string {
  const raw = headers.get('set-cookie') || '';
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  if (!m) throw new Error(`cookie ${name} not found in Set-Cookie: ${raw}`);
  return `${name}=${m[1]}`;
}

describe('Auth & OAuth 2.1 (#194)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.dispose();
  });

  describe('#195 PBKDF2 password hashing & legacy migration', () => {
    it('registers new accounts with versioned PBKDF2-SHA256 hash and allows login', async () => {
      const regRes = await h.request('/auth/register', {
        method: 'POST',
        body: { email: 'pbkdf2-new@x.com', password: 'secret-password', name: 'NewUser' },
      });
      expect(regRes.status).toBe(201);
      expect(regRes.json.success).toBe(true);
      expect(regRes.json.data.token).toBeTruthy();

      const row = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE email = ?')
        .bind('pbkdf2-new@x.com')
        .first<{ password_hash: string; salt: string }>();
      expect(row).toBeTruthy();
      expect(row!.password_hash.startsWith('pbkdf2$100000$')).toBe(true);
      expect(row!.salt.length).toBe(32);

      const loginRes = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'pbkdf2-new@x.com', password: 'secret-password' },
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.json.success).toBe(true);
    });

    it('rejects wrong password on legacy SHA-256 account without migrating hash', async () => {
      const legacySalt = '00112233445566778899aabbccddeeff';
      const legacyHash = await hashPassword('old-pass-123', legacySalt);
      await h.db
        .prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
        .bind('u_legacy_1', 'legacy1@x.com', 'Legacy1', legacyHash, legacySalt)
        .run();

      const badRes = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy1@x.com', password: 'wrong-password' },
      });
      expect(badRes.status).toBe(401);
      expect(badRes.json.success).toBe(false);

      const rowAfterBad = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
        .bind('u_legacy_1')
        .first<{ password_hash: string; salt: string }>();
      expect(rowAfterBad!.password_hash).toBe(legacyHash);
      expect(rowAfterBad!.salt).toBe(legacySalt);
    });

    it('transparently migrates legacy SHA-256 hash to PBKDF2 upon successful login', async () => {
      const legacySalt = 'ffeeddccbbaa99887766554433221100';
      const legacyHash = await hashPassword('migrate-me-123', legacySalt);
      await h.db
        .prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
        .bind('u_legacy_2', 'legacy2@x.com', 'Legacy2', legacyHash, legacySalt)
        .run();

      const loginRes1 = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy2@x.com', password: 'migrate-me-123' },
      });
      expect(loginRes1.status).toBe(200);
      expect(loginRes1.json.success).toBe(true);

      const rowAfterLogin = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
        .bind('u_legacy_2')
        .first<{ password_hash: string; salt: string }>();
      expect(rowAfterLogin!.password_hash.startsWith('pbkdf2$100000$')).toBe(true);
      expect(rowAfterLogin!.salt).not.toBe(legacySalt);

      // Subsequent login with migrated PBKDF2 hash still succeeds
      const loginRes2 = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy2@x.com', password: 'migrate-me-123' },
      });
      expect(loginRes2.status).toBe(200);
      expect(loginRes2.json.success).toBe(true);
    });
  });

  describe('#196 OAuth 2.1 Authorization Code + PKCE & Worker Login Page', () => {
    const WEB_REDIRECT = 'http://localhost:5173/oauth/callback';
    const IOS_REDIRECT = 'com.raychiu.mymoney:/oauth/callback';

    async function rawFetch(path: string, init: RequestInit = {}) {
      return app.fetch(new Request(`http://localhost${path}`, init), h.env as any);
    }

    async function authorizeAndGetCode(opts: {
      email: string;
      password: string;
      verifier?: string;
      clientId?: string;
      redirectUri?: string;
      state?: string;
      userAgent?: string;
    }) {
      const verifier = opts.verifier ?? 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await sha256Base64url(verifier);
      const clientId = opts.clientId ?? 'web';
      const redirectUri = opts.redirectUri ?? WEB_REDIRECT;
      const state = opts.state ?? 'st-123';

      const getRes = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&state=${encodeURIComponent(state)}`,
        { headers: opts.userAgent ? { 'User-Agent': opts.userAgent } : undefined }
      );
      expect(getRes.status).toBe(200);
      const html = await getRes.text();
      const csrf = extractCsrfToken(html);
      const cookie = extractSetCookie(getRes.headers, 'mm_oauth_tx');

      const form = new URLSearchParams({
        email: opts.email,
        password: opts.password,
        csrf_token: csrf,
      });
      const postRes = await rawFetch('/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookie,
          ...(opts.userAgent ? { 'User-Agent': opts.userAgent } : {}),
        },
        body: form.toString(),
      });
      return { getRes, html, postRes, verifier, clientId, redirectUri, state };
    }

    it('serves RFC 8414 metadata at /.well-known/oauth-authorization-server', async () => {
      const res = await rawFetch('/.well-known/oauth-authorization-server');
      expect(res.status).toBe(200);
      const meta: any = await res.json();
      expect(meta.issuer).toBe('http://localhost');
      expect(meta.authorization_endpoint).toBe('http://localhost/oauth/authorize');
      expect(meta.token_endpoint).toBe('http://localhost/oauth/token');
      expect(meta.revocation_endpoint).toBe('http://localhost/oauth/revoke');
      expect(meta.response_types_supported).toEqual(['code']);
      expect(meta.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
      expect(meta.code_challenge_methods_supported).toEqual(['S256']);
      expect(meta.scopes_supported).toEqual(['full']);
    });

    it('completes full authorization_code + PKCE flow, issues 15m access token, and calls API', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        await h.request('/auth/register', {
          method: 'POST',
          body: { email: 'oauth1@x.com', password: 'password123', name: 'OAuthOne' },
        });

        const { getRes, postRes, verifier } = await authorizeAndGetCode({
          email: 'oauth1@x.com',
          password: 'password123',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
        });

        // Security headers on login page
        expect(getRes.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
        expect(getRes.headers.get('x-frame-options')).toBe('DENY');

        expect(postRes.status).toBe(302);
        const location = new URL(postRes.headers.get('location')!);
        expect(location.origin + location.pathname).toBe(WEB_REDIRECT);
        expect(location.searchParams.get('state')).toBe('st-123');
        const code = location.searchParams.get('code')!;
        expect(code).toBeTruthy();

        const tokenRes = await rawFetch('/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: 'http://localhost:5173',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: WEB_REDIRECT,
            client_id: 'web',
            code_verifier: verifier,
          }).toString(),
        });
        expect(tokenRes.status).toBe(200);
        expect(tokenRes.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
        const tok: any = await tokenRes.json();
        expect(tok.token_type).toBe('Bearer');
        expect(tok.expires_in).toBe(900);
        expect(tok.scope).toBe('full');
        expect(tok.access_token).toBeTruthy();
        expect(tok.refresh_token).toBeTruthy();

        // Access token works on existing APIs via Authorization header
        const apiRes = await rawFetch('/accounts', {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        expect(apiRes.status).toBe(200);

        // New-format access token is rejected in ?token= query param
        const queryRes = await rawFetch(`/accounts?token=${encodeURIComponent(tok.access_token)}`);
        expect(queryRes.status).toBe(401);
        expect(queryRes.headers.get('www-authenticate')).toContain('invalid_token');

        // Access token expires after 15 minutes
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 15 * 60 * 1000 + 1000));
        const expiredRes = await rawFetch('/accounts', {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        expect(expiredRes.status).toBe(401);
        expect(expiredRes.headers.get('www-authenticate')).toContain('invalid_token');
      } finally {
        vi.useRealTimers();
      }
    });

    it('supports iOS custom scheme redirect_uri', async () => {
      const { postRes } = await authorizeAndGetCode({
        email: 'oauth1@x.com',
        password: 'password123',
        clientId: 'ios',
        redirectUri: IOS_REDIRECT,
      });
      expect(postRes.status).toBe(302);
      const loc = postRes.headers.get('location')!;
      expect(loc.startsWith(`${IOS_REDIRECT}?code=`)).toBe(true);
    });

    it('shows error page without redirecting when client_id or redirect_uri is invalid', async () => {
      const challenge = await sha256Base64url('verifier-xyz');
      const badClient = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=evil&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256`
      );
      expect(badClient.status).toBe(400);
      expect(badClient.headers.get('location')).toBeNull();

      const badRedirect = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent('https://evil.example/cb')}&code_challenge=${challenge}&code_challenge_method=S256`
      );
      expect(badRedirect.status).toBe(400);
      expect(badRedirect.headers.get('location')).toBeNull();
    });

    it('rejects missing PKCE or plain code_challenge_method via redirect error', async () => {
      const missingPkce = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&state=s1`
      );
      expect(missingPkce.status).toBe(302);
      const loc1 = new URL(missingPkce.headers.get('location')!);
      expect(loc1.searchParams.get('error')).toBe('invalid_request');
      expect(loc1.searchParams.get('state')).toBe('s1');

      const plainPkce = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&code_challenge=abc&code_challenge_method=plain&state=s2`
      );
      expect(plainPkce.status).toBe(302);
      const loc2 = new URL(plainPkce.headers.get('location')!);
      expect(loc2.searchParams.get('error')).toBe('invalid_request');
    });

    it('rejects wrong code_verifier, code reuse, and expired code', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        const { postRes } = await authorizeAndGetCode({
          email: 'oauth1@x.com',
          password: 'password123',
          verifier: 'correct-verifier-string-1234567890',
        });
        const code1 = new URL(postRes.headers.get('location')!).searchParams.get('code')!;

        // Wrong code_verifier
        const wrongVerRes = await rawFetch('/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code1,
            redirect_uri: WEB_REDIRECT,
            client_id: 'web',
            code_verifier: 'wrong-verifier-string',
          }).toString(),
        });
        expect(wrongVerRes.status).toBe(400);
        expect(((await wrongVerRes.json()) as any).error).toBe('invalid_grant');

        // Reuse code (even with correct verifier after failed attempt) -> rejected
        const reuseRes = await rawFetch('/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code1,
            redirect_uri: WEB_REDIRECT,
            client_id: 'web',
            code_verifier: 'correct-verifier-string-1234567890',
          }).toString(),
        });
        expect(reuseRes.status).toBe(400);
        expect(((await reuseRes.json()) as any).error).toBe('invalid_grant');

        // Expired code (> 60s)
        const { postRes: postRes2 } = await authorizeAndGetCode({
          email: 'oauth1@x.com',
          password: 'password123',
          verifier: 'correct-verifier-string-2222222222',
        });
        const code2 = new URL(postRes2.headers.get('location')!).searchParams.get('code')!;
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 65 * 1000));
        const expRes = await rawFetch('/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code2,
            redirect_uri: WEB_REDIRECT,
            client_id: 'web',
            code_verifier: 'correct-verifier-string-2222222222',
          }).toString(),
        });
        expect(expRes.status).toBe(400);
        expect(((await expRes.json()) as any).error).toBe('invalid_grant');
      } finally {
        vi.useRealTimers();
      }
    });

    it('rejects POST /oauth/authorize without valid CSRF token and returns generic error on bad credentials', async () => {
      const challenge = await sha256Base64url('v-csrf');
      const getRes = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256`
      );
      const cookie = extractSetCookie(getRes.headers, 'mm_oauth_tx');

      // Missing CSRF token
      const noCsrf = await rawFetch('/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
        body: new URLSearchParams({ email: 'oauth1@x.com', password: 'password123' }).toString(),
      });
      expect(noCsrf.status).toBe(403);

      // Bad password -> generic error without leaking existence
      const csrf = extractCsrfToken(await getRes.text());
      const badPass = await rawFetch('/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
        body: new URLSearchParams({ email: 'oauth1@x.com', password: 'wrong', csrf_token: csrf }).toString(),
      });
      expect(badPass.status).toBe(401);
      const badHtml = await badPass.text();
      expect(badHtml).toContain('Email 或密碼錯誤');
    });
  });

  describe('#197 Refresh Token rotation, reuse detection, idle TTL & revocation', () => {
    const WEB_REDIRECT = 'http://localhost:5173/oauth/callback';

    async function rawFetch(path: string, init: RequestInit = {}) {
      return app.fetch(new Request(`http://localhost${path}`, init), h.env as any);
    }

    async function loginViaOAuth(email: string, password: string) {
      const verifier = `verifier-${Math.random().toString(36).slice(2)}-padding-1234567890`;
      const challenge = await sha256Base64url(verifier);
      const getRes = await rawFetch(
        `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256&state=s`
      );
      const csrf = extractCsrfToken(await getRes.text());
      const cookie = extractSetCookie(getRes.headers, 'mm_oauth_tx');
      const postRes = await rawFetch('/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
        body: new URLSearchParams({ email, password, csrf_token: csrf }).toString(),
      });
      const code = new URL(postRes.headers.get('location')!).searchParams.get('code')!;
      const tokenRes = await rawFetch('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: WEB_REDIRECT,
          client_id: 'web',
          code_verifier: verifier,
        }).toString(),
      });
      expect(tokenRes.status).toBe(200);
      return (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number };
    }

    async function refreshCall(refreshToken: string, clientId = 'web') {
      return rawFetch('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://localhost:5173' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        }).toString(),
      });
    }

    it('rotates refresh token and returns same refresh token idempotently within 30s grace window', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        await h.request('/auth/register', {
          method: 'POST',
          body: { email: 'rt1@x.com', password: 'password123', name: 'RT1' },
        });
        const initial = await loginViaOAuth('rt1@x.com', 'password123');

        // First refresh
        const res1 = await refreshCall(initial.refresh_token);
        expect(res1.status).toBe(200);
        const tok1: any = await res1.json();
        expect(tok1.refresh_token).toBeTruthy();
        expect(tok1.refresh_token).not.toBe(initial.refresh_token);
        expect(tok1.access_token).toBeTruthy();

        // Reuse old token within 30s (e.g. +10s) -> idempotent, returns same new refresh token
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 10 * 1000));
        const resGrace = await refreshCall(initial.refresh_token);
        expect(resGrace.status).toBe(200);
        const tokGrace: any = await resGrace.json();
        expect(tokGrace.refresh_token).toBe(tok1.refresh_token);

        // New token still works
        const res2 = await refreshCall(tok1.refresh_token);
        expect(res2.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it('revokes entire session when rotated refresh token is reused after 30s grace window', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        const initial = await loginViaOAuth('rt1@x.com', 'password123');
        const res1 = await refreshCall(initial.refresh_token);
        expect(res1.status).toBe(200);
        const tok1: any = await res1.json();

        // Reuse old token after 31s -> invalid_grant AND revokes session (tok1 becomes invalid too)
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 31 * 1000));
        const reuseRes = await refreshCall(initial.refresh_token);
        expect(reuseRes.status).toBe(400);
        expect(((await reuseRes.json()) as any).error).toBe('invalid_grant');

        const latestRes = await refreshCall(tok1.refresh_token);
        expect(latestRes.status).toBe(400);
        expect(((await latestRes.json()) as any).error).toBe('invalid_grant');
      } finally {
        vi.useRealTimers();
      }
    });

    it('expires session after 30 days of inactivity and slides expiration on active use', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        const s1 = await loginViaOAuth('rt1@x.com', 'password123');
        const s2 = await loginViaOAuth('rt1@x.com', 'password123');

        // Advance 20 days: use s1 (slides s1 expiry to day 50), leave s2 idle
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 20 * 86400 * 1000));
        const r1 = await refreshCall(s1.refresh_token);
        expect(r1.status).toBe(200);
        const s1Next: any = await r1.json();

        // Advance to day 31: s2 is expired (>30d idle), s1 is still valid
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 31 * 86400 * 1000));
        const r2Expired = await refreshCall(s2.refresh_token);
        expect(r2Expired.status).toBe(400);

        const r1StillValid = await refreshCall(s1Next.refresh_token);
        expect(r1StillValid.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it('revokes session via POST /oauth/revoke and returns 200 even for unknown tokens', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FIXED_NOW);
      try {
        const s = await loginViaOAuth('rt1@x.com', 'password123');

        const revokeRes = await rawFetch('/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://localhost:5173' },
          body: new URLSearchParams({ token: s.refresh_token }).toString(),
        });
        expect(revokeRes.status).toBe(200);
        expect(revokeRes.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

        const afterRevoke = await refreshCall(s.refresh_token);
        expect(afterRevoke.status).toBe(400);

        const unknownRevoke = await rawFetch('/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: 'non-existent-token' }).toString(),
        });
        expect(unknownRevoke.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cascades session deletion when user deletes account', async () => {
      await h.request('/auth/register', {
        method: 'POST',
        body: { email: 'del-oauth@x.com', password: 'password123', name: 'DelOAuth' },
      });
      const tok = await loginViaOAuth('del-oauth@x.com', 'password123');
      const userRow = await h.db.prepare('SELECT id FROM users WHERE email = ?').bind('del-oauth@x.com').first<{ id: string }>();
      expect(userRow).toBeTruthy();

      const delRes = await rawFetch('/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      expect(delRes.status).toBe(200);

      const sessionsLeft = await h.db.prepare('SELECT id FROM sessions WHERE user_id = ?').bind(userRow!.id).all();
      expect(sessionsLeft.results.length).toBe(0);
    });
  });
});
