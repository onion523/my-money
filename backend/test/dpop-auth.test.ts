import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { createHarness, type Harness } from './harness';
import { accessTokenHash } from '../src/middleware/dpop';

const WEB_REDIRECT = 'http://localhost:5173/oauth/callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64url(input: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

interface Key {
  privateKey: CryptoKey;
  jwk: JsonWebKey;
}

async function newKey(): Promise<Key> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}

async function makeProof(
  key: Key,
  opts: {
    method: string;
    url: string;
    accessToken?: string;
    iat?: number;
    jti?: string;
    typ?: string;
    alg?: string;
    jwk?: Record<string, unknown>;
    htm?: string;
    htu?: string;
    ath?: string;
  }
): Promise<string> {
  const header = { typ: opts.typ ?? 'dpop+jwt', alg: opts.alg ?? 'ES256', jwk: opts.jwk ?? key.jwk };
  const payload: Record<string, unknown> = {
    jti: opts.jti ?? crypto.randomUUID(),
    htm: opts.htm ?? opts.method,
    htu: opts.htu ?? opts.url,
    iat: opts.iat ?? Math.floor(Date.now() / 1000),
  };
  if (opts.accessToken !== undefined) payload.ath = opts.ath ?? (await accessTokenHash(opts.accessToken));
  else if (opts.ath) payload.ath = opts.ath;
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${b64url(sig)}`;
}

describe('DPoP key-bound OAuth sessions (#193)', () => {
  let h: Harness;
  let userSeq = 0;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.dispose();
  });

  const rawFetch = (path: string, init: RequestInit = {}, env: any = h.env) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  async function getAuthCode(): Promise<string> {
    const email = `dpop${++userSeq}@x.com`;
    await h.request('/auth/register', {
      method: 'POST',
      body: { email, password: 'password123', name: 'Dpop' },
    });
    const challenge = await sha256Base64url(VERIFIER);
    const getRes = await rawFetch(
      `/oauth/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(WEB_REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256&state=s`
    );
    const html = await getRes.text();
    const csrf = html.match(/name="csrf_token"\s+value="([^"]+)"/)![1];
    const postRes = await rawFetch('/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password: 'password123', csrf_token: csrf }).toString(),
    });
    expect(postRes.status).toBe(302);
    return new URL(postRes.headers.get('location')!).searchParams.get('code')!;
  }

  async function tokenRequest(form: Record<string, string>, proof?: string, env: any = h.env) {
    const res = await rawFetch(
      '/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(proof ? { DPoP: proof } : {}),
        },
        body: new URLSearchParams(form).toString(),
      },
      env
    );
    return { res, json: (await res.json()) as any };
  }

  async function bindSession(key: Key) {
    const code = await getAuthCode();
    const proof = await makeProof(key, { method: 'POST', url: 'http://localhost/oauth/token' });
    const { res, json } = await tokenRequest(
      { grant_type: 'authorization_code', code, redirect_uri: WEB_REDIRECT, client_id: 'web', code_verifier: VERIFIER },
      proof
    );
    expect(res.status).toBe(200);
    return json;
  }

  async function api(path: string, token: string, key: Key | null, opts: { method?: string; scheme?: string; proofOverride?: Partial<Parameters<typeof makeProof>[1]> } = {}) {
    const method = opts.method ?? 'GET';
    const url = `http://localhost${path}`;
    const headers: Record<string, string> = { Authorization: `${opts.scheme ?? 'DPoP'} ${token}` };
    if (key) headers.DPoP = await makeProof(key, { method, url, accessToken: token, ...opts.proofOverride });
    return rawFetch(path, { method, headers });
  }

  it('binds session at /oauth/token: token_type DPoP, cnf.jkt in access token and sessions.dpop_jkt', async () => {
    const key = await newKey();
    const json = await bindSession(key);
    expect(json.token_type).toBe('DPoP');
    const payload = JSON.parse(atob(json.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.cnf.jkt).toBeTruthy();
    const row = await h.db
      .prepare('SELECT dpop_jkt FROM sessions WHERE id = ?')
      .bind(payload.sid)
      .first<{ dpop_jkt: string }>();
    expect(row!.dpop_jkt).toBe(payload.cnf.jkt);
  });

  it('keeps unbound Bearer behavior when no DPoP header is sent (transition period)', async () => {
    const code = await getAuthCode();
    const { res, json } = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: WEB_REDIRECT,
      client_id: 'web',
      code_verifier: VERIFIER,
    });
    expect(res.status).toBe(200);
    expect(json.token_type).toBe('Bearer');
    const ok = await api('/auth/sessions', json.access_token, null, { scheme: 'Bearer' });
    expect(ok.status).toBe(200);
  });

  it('accepts a valid proof on GET and rejects the token used as Bearer', async () => {
    const key = await newKey();
    const json = await bindSession(key);
    expect((await api('/auth/sessions', json.access_token, key)).status).toBe(200);

    const bearer = await api('/auth/sessions', json.access_token, null, { scheme: 'Bearer' });
    expect(bearer.status).toBe(401);
    const viaQuery = await rawFetch(`/auth/sessions?token=${json.access_token}`);
    expect(viaQuery.status).toBe(401);
  });

  it('rejects wrong htm, htu, ath, key mismatch, stale iat, alg none/HS256, wrong typ and private jwk', async () => {
    const key = await newKey();
    const other = await newKey();
    const json = await bindSession(key);
    const t = json.access_token;
    const now = Math.floor(Date.now() / 1000);

    const cases: Array<Partial<Parameters<typeof makeProof>[1]>> = [
      { htm: 'POST' },
      { htu: 'http://localhost/auth/other' },
      { ath: 'wrong-ath' },
      { iat: now - 3600 },
      { iat: now + 3600 },
      { alg: 'HS256' },
      { alg: 'none' },
      { typ: 'JWT' },
      { jwk: { ...key.jwk, d: 'secret' } },
    ];
    for (const proofOverride of cases) {
      const res = await api('/auth/sessions', t, key, { proofOverride });
      expect(res.status, JSON.stringify(proofOverride)).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain('invalid_dpop_proof');
      expect(res.headers.get('date')).toBeTruthy();
    }

    // 另一把金鑰簽的 proof（thumbprint 與 cnf.jkt 不符）
    const mismatch = await api('/auth/sessions', t, other);
    expect(mismatch.status).toBe(401);
    expect(mismatch.headers.get('www-authenticate')).toContain('invalid_dpop_proof');

    // 缺少 proof
    const missing = await api('/auth/sessions', t, null);
    expect(missing.status).toBe(401);
  });

  it('distinguishes invalid_token from invalid_dpop_proof', async () => {
    const key = await newKey();
    const res = await api('/auth/sessions', 'not-a-jwt', key);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('rejects jti replay on write requests but not on GET', async () => {
    const key = await newKey();
    const json = await bindSession(key);
    const t = json.access_token;

    const getProof = await makeProof(key, { method: 'GET', url: 'http://localhost/auth/sessions', accessToken: t, jti: 'get-jti-1' });
    for (let i = 0; i < 2; i++) {
      const r = await rawFetch('/auth/sessions', { headers: { Authorization: `DPoP ${t}`, DPoP: getProof } });
      expect(r.status).toBe(200);
    }

    const delProof = await makeProof(key, { method: 'DELETE', url: 'http://localhost/auth/sessions/none', accessToken: t, jti: 'del-jti-1' });
    const first = await rawFetch('/auth/sessions/none', { method: 'DELETE', headers: { Authorization: `DPoP ${t}`, DPoP: delProof } });
    expect(first.status).not.toBe(401);
    const second = await rawFetch('/auth/sessions/none', { method: 'DELETE', headers: { Authorization: `DPoP ${t}`, DPoP: delProof } });
    expect(second.status).toBe(401);
    expect(second.headers.get('www-authenticate')).toContain('invalid_dpop_proof');
  });

  it('rejects jti replay at /oauth/token and does not burn the code on bad proof (clock skew retry)', async () => {
    const key = await newKey();
    const code = await getAuthCode();
    const form = { grant_type: 'authorization_code', code, redirect_uri: WEB_REDIRECT, client_id: 'web', code_verifier: VERIFIER };

    const stale = await makeProof(key, { method: 'POST', url: 'http://localhost/oauth/token', iat: Math.floor(Date.now() / 1000) - 3600 });
    const bad = await tokenRequest(form, stale);
    expect(bad.res.status).toBe(400);
    expect(bad.json.error).toBe('invalid_dpop_proof');
    expect(bad.res.headers.get('date')).toBeTruthy();

    const good = await makeProof(key, { method: 'POST', url: 'http://localhost/oauth/token', jti: 'token-jti-1' });
    const ok = await tokenRequest(form, good);
    expect(ok.res.status).toBe(200);

    const code2 = await getAuthCode();
    const replay = await tokenRequest({ ...form, code: code2 }, good);
    expect(replay.res.status).toBe(400);
    expect(replay.json.error).toBe('invalid_dpop_proof');
  });

  it('requires the same key on refresh and rotates refresh token with bound access token', async () => {
    const key = await newKey();
    const other = await newKey();
    const json = await bindSession(key);
    const url = 'http://localhost/oauth/token';
    const form = { grant_type: 'refresh_token', refresh_token: json.refresh_token, client_id: 'web' };

    const noProof = await tokenRequest(form);
    expect(noProof.res.status).toBe(400);
    expect(noProof.json.error).toBe('invalid_dpop_proof');

    const wrongKey = await tokenRequest(form, await makeProof(other, { method: 'POST', url }));
    expect(wrongKey.res.status).toBe(400);
    expect(wrongKey.json.error).toBe('invalid_dpop_proof');

    const ok = await tokenRequest(form, await makeProof(key, { method: 'POST', url }));
    expect(ok.res.status).toBe(200);
    expect(ok.json.token_type).toBe('DPoP');
    expect((await api('/auth/sessions', ok.json.access_token, key)).status).toBe(200);
  });

  it('enforces DPOP_REQUIRED: rejects unbound auth code exchange, unbound sessions and unbound refresh', async () => {
    // 先在過渡期建立一個未綁定 session
    const code = await getAuthCode();
    const unbound = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: WEB_REDIRECT,
      client_id: 'web',
      code_verifier: VERIFIER,
    });
    expect(unbound.res.status).toBe(200);

    const strictEnv = { ...h.env, DPOP_REQUIRED: 'true' };

    const apiStrict = await rawFetch(
      '/auth/sessions',
      { headers: { Authorization: `Bearer ${unbound.json.access_token}` } },
      strictEnv
    );
    expect(apiStrict.status).toBe(401);

    const refreshStrict = await tokenRequest(
      { grant_type: 'refresh_token', refresh_token: unbound.json.refresh_token, client_id: 'web' },
      undefined,
      strictEnv
    );
    expect(refreshStrict.res.status).toBe(400);
    expect(refreshStrict.json.error).toBe('invalid_grant');

    const code2 = await getAuthCode();
    const noDpop = await tokenRequest(
      { grant_type: 'authorization_code', code: code2, redirect_uri: WEB_REDIRECT, client_id: 'web', code_verifier: VERIFIER },
      undefined,
      strictEnv
    );
    expect(noDpop.res.status).toBe(400);
    expect(noDpop.json.error).toBe('invalid_dpop_proof');
  });

  it('legacy /auth/login tokens are unaffected by DPoP', async () => {
    const email = `legacy-dpop-${++userSeq}@x.com`;
    await h.request('/auth/register', { method: 'POST', body: { email, password: 'password123', name: 'L' } });
    const login = await h.request('/auth/login', { method: 'POST', body: { email, password: 'password123' } });
    expect(login.status).toBe(200);
    const res = await api('/auth/sessions', login.json.data.token, null, { scheme: 'Bearer' });
    expect(res.status).toBe(200);
  });
});
