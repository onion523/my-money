import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { createHarness, FIXED_NOW, type Harness } from './harness';

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function cborUint(major: number, n: number): Uint8Array {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
  return new Uint8Array([(major << 5) | 25, (n >> 8) & 0xff, n & 0xff]);
}

function cborBytes(b: Uint8Array): Uint8Array {
  return concatBytes(cborUint(2, b.length), b);
}

function cborText(s: string): Uint8Array {
  const b = new TextEncoder().encode(s);
  return concatBytes(cborUint(3, b.length), b);
}

function cborNeg(n: number): Uint8Array {
  // n is negative, e.g. -7 -> encode (-1 - n) = 6 with major 1
  return cborUint(1, -1 - n);
}

function base64urlToBytes(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 將 WebCrypto IEEE P1363 (r || s) 64 bytes 簽章轉為 WebAuthn 要求的 ASN.1 DER 格式 */
function p1363ToDer(sig: Uint8Array): Uint8Array {
  const encodeInt = (bytes: Uint8Array) => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    let sliced = bytes.slice(i);
    if (sliced[0] & 0x80) sliced = concatBytes(new Uint8Array([0]), sliced);
    return concatBytes(new Uint8Array([0x02, sliced.length]), sliced);
  };
  const r = encodeInt(sig.slice(0, 32));
  const s = encodeInt(sig.slice(32, 64));
  const seq = concatBytes(r, s);
  return concatBytes(new Uint8Array([0x30, seq.length]), seq);
}

interface SoftAuthenticator {
  credIdBytes: Uint8Array;
  credId: string;
  keyPair: CryptoKeyPair;
  counter: number;
}

async function createSoftAuthenticator(): Promise<SoftAuthenticator> {
  const credIdBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  return { credIdBytes, credId: b64url(credIdBytes), keyPair, counter: 0 };
}

async function buildRegistrationResponse(
  auth: SoftAuthenticator,
  options: any,
  overrides: { origin?: string; rpId?: string; uv?: boolean; counter?: number } = {}
) {
  const origin = overrides.origin ?? 'http://localhost:5173';
  const rpId = overrides.rpId ?? options.rp.id;
  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  const flags = 0x01 | (overrides.uv === false ? 0 : 0x04) | 0x40; // UP + UV + AT
  const counter = overrides.counter ?? auth.counter;
  const counterBytes = new Uint8Array([
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  ]);
  const aaguid = new Uint8Array(16);
  const credLen = new Uint8Array([(auth.credIdBytes.length >> 8) & 0xff, auth.credIdBytes.length & 0xff]);

  const jwk = await crypto.subtle.exportKey('jwk', auth.keyPair.publicKey);
  const x = base64urlToBytes(jwk.x!);
  const y = base64urlToBytes(jwk.y!);
  // COSE_Key map (5 entries): 1:2 (EC2), 3:-7 (ES256), -1:1 (P-256), -2:x, -3:y
  const coseKey = concatBytes(
    new Uint8Array([0xa5]),
    cborUint(0, 1), cborUint(0, 2),
    cborUint(0, 3), cborNeg(-7),
    cborNeg(-1), cborUint(0, 1),
    cborNeg(-2), cborBytes(x),
    cborNeg(-3), cborBytes(y)
  );

  const authData = concatBytes(rpIdHash, new Uint8Array([flags]), counterBytes, aaguid, credLen, auth.credIdBytes, coseKey);
  // AttestationObject: { fmt: "none", attStmt: {}, authData }
  const attestationObject = concatBytes(
    new Uint8Array([0xa3]),
    cborText('fmt'), cborText('none'),
    cborText('attStmt'), new Uint8Array([0xa0]),
    cborText('authData'), cborBytes(authData)
  );
  const clientDataJSON = b64url(
    JSON.stringify({
      type: 'webauthn.create',
      challenge: options.challenge,
      origin,
      crossOrigin: false,
    })
  );

  return {
    id: auth.credId,
    rawId: auth.credId,
    type: 'public-key' as const,
    authenticatorAttachment: 'platform' as const,
    clientExtensionResults: {},
    response: {
      attestationObject: b64url(attestationObject),
      clientDataJSON,
      transports: ['internal'],
    },
  };
}

async function buildAuthenticationResponse(
  auth: SoftAuthenticator,
  options: any,
  overrides: { origin?: string; rpId?: string; uv?: boolean; counter?: number } = {}
) {
  const origin = overrides.origin ?? 'http://localhost:5173';
  const rpId = overrides.rpId ?? options.rpId;
  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  const flags = 0x01 | (overrides.uv === false ? 0 : 0x04); // UP + UV
  const counter = overrides.counter ?? auth.counter;
  const counterBytes = new Uint8Array([
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  ]);
  const authenticatorData = concatBytes(rpIdHash, new Uint8Array([flags]), counterBytes);
  const clientDataRaw = JSON.stringify({
    type: 'webauthn.get',
    challenge: options.challenge,
    origin,
    crossOrigin: false,
  });
  const clientDataBytes = new TextEncoder().encode(clientDataRaw);
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
  const sigInput = concatBytes(authenticatorData, clientDataHash);
  const sigRaw = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, auth.keyPair.privateKey, sigInput)
  );
  const signature = p1363ToDer(sigRaw);

  return {
    id: auth.credId,
    rawId: auth.credId,
    type: 'public-key' as const,
    authenticatorAttachment: 'platform' as const,
    clientExtensionResults: {},
    response: {
      authenticatorData: b64url(authenticatorData),
      clientDataJSON: b64url(clientDataBytes),
      signature: b64url(signature),
      userHandle: b64url('handle'),
    },
  };
}

describe('Passkey (WebAuthn) Authentication (#192)', () => {
  let h: Harness;
  let seq = 0;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.dispose();
  });

  const rawFetch = (path: string, init: RequestInit = {}, env: any = h.env) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  async function registerUser(emailPrefix = 'pk') {
    const email = `${emailPrefix}${++seq}@x.com`;
    const res = await h.request('/auth/register', {
      method: 'POST',
      body: { email, password: 'password123', name: 'PKUser' },
    });
    expect(res.status).toBe(201);
    return { email, token: res.json.data.token as string, userId: res.json.data.user.id as string };
  }

  const authReq = (path: string, token: string, opts: { method?: string; body?: unknown } = {}) =>
    h.request(path, { ...opts, headers: { Authorization: `Bearer ${token}` } });

  async function enrollPasskey(token: string, name = 'MacBook', initialCounter = 0) {
    const optRes = await authReq('/auth/passkey/register/options', token, { method: 'POST' });
    expect(optRes.status).toBe(200);
    const options = optRes.json.data;
    expect(options.rp.id).toBe('localhost');
    expect(options.authenticatorSelection.residentKey).toBe('required');
    expect(options.authenticatorSelection.userVerification).toBe('required');

    const auth = await createSoftAuthenticator();
    auth.counter = initialCounter;
    const regResp = await buildRegistrationResponse(auth, options);

    const verRes = await authReq('/auth/passkey/register/verify', token, {
      method: 'POST',
      body: { response: regResp, name },
    });
    expect(verRes.status).toBe(201);
    return { auth, passkey: verRes.json.data };
  }

  it('registers, lists, excludes duplicate, renames, and deletes passkey with ownership isolation', async () => {
    const u1 = await registerUser('own1');
    const u2 = await registerUser('own2');
    const { passkey } = await enrollPasskey(u1.token, 'iPhone 16');

    const list1 = await authReq('/auth/passkeys', u1.token);
    expect(list1.status).toBe(200);
    expect(list1.json.data).toHaveLength(1);
    expect(list1.json.data[0].name).toBe('iPhone 16');

    // Second registration options excludes first credential
    const opt2 = await authReq('/auth/passkey/register/options', u1.token, { method: 'POST' });
    expect(opt2.json.data.excludeCredentials).toHaveLength(1);

    // Other user cannot rename or delete u1's passkey
    const patchOther = await authReq(`/auth/passkeys/${passkey.id}`, u2.token, {
      method: 'PATCH',
      body: { name: 'Hacked' },
    });
    expect(patchOther.status).toBe(404);

    const delOther = await authReq(`/auth/passkeys/${passkey.id}`, u2.token, {
      method: 'DELETE',
    });
    expect(delOther.status).toBe(404);

    // Owner can rename and delete
    const patchOk = await authReq(`/auth/passkeys/${passkey.id}`, u1.token, {
      method: 'PATCH',
      body: { name: 'Work Mac' },
    });
    expect(patchOk.status).toBe(200);
    expect(patchOk.json.data.name).toBe('Work Mac');

    const delOk = await authReq(`/auth/passkeys/${passkey.id}`, u1.token, {
      method: 'DELETE',
    });
    expect(delOk.status).toBe(200);

    const listAfter = await authReq('/auth/passkeys', u1.token);
    expect(listAfter.json.data).toHaveLength(0);
  });

  it('completes OAuth 2.1 bridge login via POST /oauth/passkey/authorize + /oauth/token', async () => {
    const u = await registerUser('oauthpk');
    const { auth } = await enrollPasskey(u.token, 'Browser');

    const optRes = await h.request('/auth/passkey/login/options', { method: 'POST' });
    expect(optRes.status).toBe(200);
    const options = optRes.json.data;
    expect(options.allowCredentials).toEqual([]);

    const assertion = await buildAuthenticationResponse(auth, options);
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

    const bridgeRes = await rawFetch('/oauth/passkey/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: assertion,
        client_id: 'web',
        redirect_uri: 'http://localhost:5173/oauth/callback',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'st-pk',
      }),
    });
    expect(bridgeRes.status).toBe(200);
    const bridgeJson = (await bridgeRes.json()) as any;
    expect(bridgeJson.success).toBe(true);
    expect(bridgeJson.data.code).toBeTruthy();
    expect(bridgeJson.data.state).toBe('st-pk');

    // Exchange code at /oauth/token
    const tokenRes = await rawFetch('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: bridgeJson.data.code,
        redirect_uri: 'http://localhost:5173/oauth/callback',
        client_id: 'web',
        code_verifier: verifier,
      }).toString(),
    });
    expect(tokenRes.status).toBe(200);
    const tokenJson = (await tokenRes.json()) as any;
    expect(tokenJson.access_token).toBeTruthy();
    expect(tokenJson.refresh_token).toBeTruthy();

    // Access protected API with issued access token
    const sessRes = await rawFetch('/auth/sessions', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    expect(sessRes.status).toBe(200);
  });

  it('supports iOS legacy transition endpoint POST /auth/passkey/login/verify and respects LEGACY_AUTH_ENABLED=false', async () => {
    const u = await registerUser('iospk');
    const { auth } = await enrollPasskey(u.token, 'iPhone');

    const optRes = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const assertion = await buildAuthenticationResponse(auth, optRes.json.data);

    const verifyRes = await h.request('/auth/passkey/login/verify', {
      method: 'POST',
      body: { response: assertion },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.json.data.token).toBeTruthy();
    expect(verifyRes.json.data.user.email).toBe(u.email);

    // Disabled when LEGACY_AUTH_ENABLED=false
    const disabledRes = await rawFetch(
      '/auth/passkey/login/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      },
      { ...h.env, LEGACY_AUTH_ENABLED: 'false' }
    );
    expect(disabledRes.status).toBe(403);
  });

  it('rejects challenge replay, expired challenge, wrong origin/RP ID, missing UV, and cloned counter rollback (allows 0->0)', async () => {
    const u = await registerUser('secpk');
    // 1) Synced passkey with counter 0 -> 0 is allowed
    const { auth: syncAuth } = await enrollPasskey(u.token, 'Synced', 0);
    const opt0 = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const a0 = await buildAuthenticationResponse(syncAuth, opt0.json.data, { counter: 0 });
    const ok0 = await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: a0 } });
    expect(ok0.status).toBe(200);

    // Challenge replay is rejected (401)
    const replay = await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: a0 } });
    expect(replay.status).toBe(401);

    // Wrong origin
    const optOrigin = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const badOrigin = await buildAuthenticationResponse(syncAuth, optOrigin.json.data, { origin: 'https://evil.com' });
    expect((await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: badOrigin } })).status).toBe(401);

    // Wrong RP ID
    const optRp = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const badRp = await buildAuthenticationResponse(syncAuth, optRp.json.data, { rpId: 'evil.com' });
    expect((await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: badRp } })).status).toBe(401);

    // UV = false
    const optUv = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const badUv = await buildAuthenticationResponse(syncAuth, optUv.json.data, { uv: false });
    expect((await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: badUv } })).status).toBe(401);

    // 2) Counter rollback (non-zero counter 5 -> 4 is rejected)
    const { auth: hwAuth } = await enrollPasskey(u.token, 'HardwareKey', 5);
    const optRollback = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const rollbackAssertion = await buildAuthenticationResponse(hwAuth, optRollback.json.data, { counter: 4 });
    const rollbackRes = await h.request('/auth/passkey/login/verify', {
      method: 'POST',
      body: { response: rollbackAssertion },
    });
    expect(rollbackRes.status).toBe(401);

    // 3) Expired challenge
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    try {
      const optExp = await h.request('/auth/passkey/login/options', { method: 'POST' });
      const expAssertion = await buildAuthenticationResponse(syncAuth, optExp.json.data);
      vi.setSystemTime(FIXED_NOW.getTime() + 6 * 60 * 1000);
      const expRes = await h.request('/auth/passkey/login/verify', {
        method: 'POST',
        body: { response: expAssertion },
      });
      expect(expRes.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cascades passkey deletion when user deletes account and rejects deleted passkey login', async () => {
    const u = await registerUser('delpk');
    const { auth, passkey } = await enrollPasskey(u.token, 'TempKey');

    // Delete passkey -> login fails
    await authReq(`/auth/passkeys/${passkey.id}`, u.token, { method: 'DELETE' });
    const opt1 = await h.request('/auth/passkey/login/options', { method: 'POST' });
    const a1 = await buildAuthenticationResponse(auth, opt1.json.data);
    expect((await h.request('/auth/passkey/login/verify', { method: 'POST', body: { response: a1 } })).status).toBe(401);

    // Enroll again and delete account -> passkey row cascaded
    await enrollPasskey(u.token, 'BeforeDelete');
    const delAcc = await authReq('/auth/account', u.token, {
      method: 'DELETE',
      body: { password: 'password123' },
    });
    expect(delAcc.status).toBe(200);
    const remaining = await h.db
      .prepare('SELECT id FROM passkeys WHERE user_id = ?')
      .bind(u.userId)
      .all();
    expect(remaining.results).toHaveLength(0);
  });
});
