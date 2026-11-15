import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { createHarness, type Harness } from './harness';

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

describe('Password Reset via Bot OTP (#212)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.dispose();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function openAuthorize(mode?: string, ip = '198.51.100.1') {
    const verifier = 'reset-verifier-0123456789abcdef0123456789abcdef';
    const challenge = await sha256Base64url(verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'web',
      redirect_uri: 'http://localhost:5173/oauth/callback',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'st-reset-1',
      scope: 'full',
    });
    if (mode) params.set('mode', mode);
    const res = await app.request(
      `/oauth/authorize?${params.toString()}`,
      { headers: { 'CF-Connecting-IP': ip } },
      { ...h.env, TELEGRAM_BOT_TOKEN: 'tg-test-token', LINE_CHANNEL_ACCESS_TOKEN: 'line-test-token' } as any
    );
    const html = await res.text();
    return { res, html, verifier, challenge, csrf: extractCsrfToken(html) };
  }

  async function postAuthorize(form: Record<string, string>, ip = '198.51.100.1') {
    const body = new URLSearchParams(form).toString();
    return app.request(
      '/oauth/authorize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'CF-Connecting-IP': ip,
        },
        body,
      },
      { ...h.env, TELEGRAM_BOT_TOKEN: 'tg-test-token', LINE_CHANNEL_ACCESS_TOKEN: 'line-test-token' } as any
    );
  }

  it('renders forgot-password link on login page preserving OAuth params and handles unknown/unbound emails neutrally', async () => {
    const { res, html, csrf } = await openAuthorize();
    expect(res.status).toBe(200);
    expect(html).toContain('忘記密碼？');
    expect(html).toContain('mode=forgot');
    expect(html).toContain('code_challenge=');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    // Unknown email -> neutral notice, no bot API calls
    const unknownRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'forgot',
      email: 'nobody@x.com',
    }, '198.51.100.10');
    expect(unknownRes.status).toBe(200);
    const unknownHtml = await unknownRes.text();
    expect(unknownHtml).toContain('若該 Email 已註冊且有綁定 LINE 或 Telegram 機器人');
    expect(unknownHtml).toContain('name="mode" value="reset"');
    expect(fetchSpy).not.toHaveBeenCalled();

    // Unbound existing user (u3 / c@x.com) -> identical neutral notice, no bot API calls
    const unboundRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'forgot',
      email: 'c@x.com',
    }, '198.51.100.11');
    expect(unboundRes.status).toBe(200);
    const unboundHtml = await unboundRes.text();
    expect(unboundHtml).toContain('若該 Email 已註冊且有綁定 LINE 或 Telegram 機器人');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends 6-digit OTP to all bound bots (LINE & Telegram), enforces rate limits, and completes full reset + session/legacy revocation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T08:00:00Z'));

    // Register a fresh user with PBKDF2 password
    const regRes = await h.request('/auth/register', {
      method: 'POST',
      body: { email: 'reset-user@x.com', password: 'old-password-123', name: 'ResetUser' },
    });
    expect(regRes.status).toBe(201);
    const legacyToken = regRes.json.data.token as string;
    const userId = regRes.json.data.user.id as string;

    // Bind both LINE and Telegram bots
    await h.db
      .prepare('INSERT INTO bot_bindings (id, user_id, platform, platform_user_id, display_name) VALUES (?, ?, ?, ?, ?)')
      .bind('bb_tg', userId, 'telegram', '999000111', 'TG User')
      .run();
    await h.db
      .prepare('INSERT INTO bot_bindings (id, user_id, platform, platform_user_id, display_name) VALUES (?, ?, ?, ?, ?)')
      .bind('bb_line', userId, 'line', 'U_LINE_123', 'LINE User')
      .run();

    // Add an existing Passkey and an active OAuth session + login lockout
    const nowSec = Math.floor(Date.now() / 1000);
    await h.db
      .prepare('INSERT INTO passkeys (id, user_id, credential_id, public_key, sign_count, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('pk_1', userId, 'cred-1', 'pub-1', 0, 'MacBook', nowSec)
      .run();
    await h.db
      .prepare('INSERT INTO sessions (id, user_id, client_id, device_name, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind('sess_old_1', userId, 'web', 'Chrome', nowSec, nowSec, nowSec + 86400)
      .run();
    await h.db
      .prepare('INSERT INTO login_attempts (attempt_key, failures, window_start, locked_until) VALUES (?, ?, ?, ?)')
      .bind('email:reset-user@x.com', 5, nowSec, nowSec + 900)
      .run();

    const sentPayloads: Array<{ url: string; body: any }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      sentPayloads.push({ url, body: JSON.parse(String(init?.body || '{}')) });
      return new Response('{"ok":true}', { status: 200 });
    });

    const { csrf, verifier } = await openAuthorize('forgot', '198.51.100.20');

    // 1st OTP request -> dispatches to both Telegram and LINE
    const req1 = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'reset-user@x.com' }, '198.51.100.20');
    expect(req1.status).toBe(200);
    expect(sentPayloads.length).toBe(2);

    const tgCall = sentPayloads.find((p) => p.url.includes('api.telegram.org'));
    const lineCall = sentPayloads.find((p) => p.url.includes('api.line.me/v2/bot/message/push'));
    expect(tgCall).toBeTruthy();
    expect(lineCall).toBeTruthy();
    expect(tgCall!.body.chat_id).toBe('999000111');
    expect(lineCall!.body.to).toBe('U_LINE_123');

    const otpMatch1 = tgCall!.body.text.match(/(\d{6})/);
    const otpMatch2 = lineCall!.body.messages[0].text.match(/(\d{6})/);
    expect(otpMatch1).toBeTruthy();
    expect(otpMatch2).toBeTruthy();
    expect(otpMatch1![1]).toBe(otpMatch2![1]);
    const firstOtp = otpMatch1![1];

    // Cooldown check: immediate 2nd request within 60s -> 429
    const reqCooldown = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'reset-user@x.com' }, '198.51.100.20');
    expect(reqCooldown.status).toBe(429);

    // Advance 61s -> 2nd request succeeds and invalidates firstOtp
    vi.advanceTimersByTime(61_000);
    sentPayloads.length = 0;
    const req2 = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'reset-user@x.com' }, '198.51.100.20');
    expect(req2.status).toBe(200);
    expect(sentPayloads.length).toBe(2);
    const secondOtp = sentPayloads[0].body.text.match(/(\d{6})/)![1];

    // Old OTP is invalidated
    const oldOtpRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'reset',
      email: 'reset-user@x.com',
      code: firstOtp === secondOtp ? '000000' : firstOtp,
      password: 'new-password-456',
    }, '198.51.100.20');
    expect(oldOtpRes.status).toBe(400);

    // Correct secondOtp succeeds, revokes sessions & legacy token, clears lockout, keeps passkey
    const resetRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'reset',
      email: 'reset-user@x.com',
      code: secondOtp,
      password: 'new-password-456',
    }, '198.51.100.20');
    expect(resetRes.status).toBe(200);
    const resetHtml = await resetRes.text();
    expect(resetHtml).toContain('密碼已重設，請使用新密碼登入');
    expect(resetHtml).toContain('name="mode" value="login"');

    // Old OTP cannot be reused
    const reuseRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'reset',
      email: 'reset-user@x.com',
      code: secondOtp,
      password: 'another-password',
    }, '198.51.100.20');
    expect(reuseRes.status).toBe(400);

    // Old session is revoked
    const sessRow = await h.db.prepare('SELECT revoked_at FROM sessions WHERE id = ?').bind('sess_old_1').first<{ revoked_at: number | null }>();
    expect(sessRow?.revoked_at).not.toBeNull();

    // Legacy token is invalidated
    const legacyCall = await h.request('/accounts', {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    expect(legacyCall.status).toBe(401);

    // Passkey is preserved
    const pkRow = await h.db.prepare('SELECT id FROM passkeys WHERE id = ?').bind('pk_1').first<{ id: string }>();
    expect(pkRow?.id).toBe('pk_1');

    // Old password fails, new password completes OAuth PKCE login (lockout was cleared!)
    const badLogin = await postAuthorize({
      csrf_token: csrf,
      mode: 'login',
      email: 'reset-user@x.com',
      password: 'old-password-123',
    }, '198.51.100.20');
    expect(badLogin.status).toBe(401);

    const goodLogin = await postAuthorize({
      csrf_token: csrf,
      mode: 'login',
      email: 'reset-user@x.com',
      password: 'new-password-456',
    }, '198.51.100.20');
    expect(goodLogin.status).toBe(302);
    const location = new URL(goodLogin.headers.get('location')!);
    const authCode = location.searchParams.get('code');
    expect(authCode).toBeTruthy();

    // Exchange OAuth code for token
    const tokenRes = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode!,
          redirect_uri: 'http://localhost:5173/oauth/callback',
          client_id: 'web',
          code_verifier: verifier,
        }).toString(),
      },
      h.env as any
    );
    expect(tokenRes.status).toBe(200);
  });

  it('rejects OTP after 5 wrong attempts, rejects expired OTP, and enforces 3/15m email & 10/15m IP rate limits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T09:00:00Z'));

    const regRes = await h.request('/auth/register', {
      method: 'POST',
      body: { email: 'otp-limit@x.com', password: 'password-123', name: 'LimitUser' },
    });
    const userId = regRes.json.data.user.id as string;
    await h.db
      .prepare('INSERT INTO bot_bindings (id, user_id, platform, platform_user_id, display_name) VALUES (?, ?, ?, ?, ?)')
      .bind('bb_limit', userId, 'telegram', '888000111', 'Limit TG')
      .run();

    let lastOtp = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      const m = String(parsed.text || '').match(/(\d{6})/);
      if (m) lastOtp = m[1];
      return new Response('{"ok":true}', { status: 200 });
    });

    const { csrf } = await openAuthorize('forgot', '198.51.100.30');

    // Request 1
    expect((await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'otp-limit@x.com' }, '198.51.100.30')).status).toBe(200);
    const otp1 = lastOtp;

    // 5 wrong attempts invalidate otp1
    const wrongCode = otp1 === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) {
      const r = await postAuthorize({
        csrf_token: csrf,
        mode: 'reset',
        email: 'otp-limit@x.com',
        code: wrongCode,
        password: 'new-password-999',
      }, '198.51.100.30');
      expect(r.status).toBe(400);
    }
    // Even the real otp1 is now invalidated
    const after5Res = await postAuthorize({
      csrf_token: csrf,
      mode: 'reset',
      email: 'otp-limit@x.com',
      code: otp1,
      password: 'new-password-999',
    }, '198.51.100.30');
    expect(after5Res.status).toBe(400);

    // Advance 61s -> Request 2, then expire it (> 10 minutes)
    vi.advanceTimersByTime(61_000);
    expect((await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'otp-limit@x.com' }, '198.51.100.30')).status).toBe(200);
    const otp2 = lastOtp;
    vi.advanceTimersByTime(10 * 60_000 + 1_000);
    const expiredRes = await postAuthorize({
      csrf_token: csrf,
      mode: 'reset',
      email: 'otp-limit@x.com',
      code: otp2,
      password: 'new-password-999',
    }, '198.51.100.30');
    expect(expiredRes.status).toBe(400);

    // Request 3 (still within 15m window: total 3 requests), then Request 4 -> 429
    expect((await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'otp-limit@x.com' }, '198.51.100.30')).status).toBe(200);
    vi.advanceTimersByTime(61_000);
    const req4 = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'otp-limit@x.com' }, '198.51.100.30');
    expect(req4.status).toBe(429);

    // IP rate limit: 10 requests per 15m across distinct emails -> 11th returns 429
    for (let i = 0; i < 10; i++) {
      const r = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: `ip-test-${i}@x.com` }, '198.51.100.99');
      expect(r.status).toBe(200);
    }
    const ip11 = await postAuthorize({ csrf_token: csrf, mode: 'forgot', email: 'ip-test-10@x.com' }, '198.51.100.99');
    expect(ip11.status).toBe(429);
  });
});
