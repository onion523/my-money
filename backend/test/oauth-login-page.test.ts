import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { createHarness, type Harness } from './harness';

// Worker 登入頁的生物辨識入口與字級(#215)
describe('OAuth 登入頁：生物辨識入口與字級 (#215)', () => {
  const IOS_REDIRECT = 'com.raychiu.mymoney:/oauth/callback';
  const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.dispose();
  });

  async function rawFetch(path: string, init: RequestInit = {}) {
    return app.fetch(new Request(`http://localhost${path}`, init), h.env as any);
  }

  async function openLogin(extra: string) {
    const res = await rawFetch(
      `/oauth/authorize?response_type=code&client_id=ios&redirect_uri=${encodeURIComponent(IOS_REDIRECT)}&code_challenge=${CHALLENGE}&code_challenge_method=S256&state=st-215${extra}`
    );
    expect(res.status).toBe(200);
    return res.text();
  }

  function decode(html: string) {
    return html.replace(/&amp;/g, '&');
  }

  it('帶 biometry=faceid:登入鈕下方有「用 Face ID 登入」,是帳密表單的第二個送出鈕(#354)', async () => {
    const html = await openLogin('&biometry=faceid');
    const form = html.match(/<form[\s\S]*?<\/form>/)?.[0] ?? '';
    expect(form).toMatch(/<button type="submit" name="biometric" value="1" class="alt-btn">[\s\S]*用 Face ID 登入<\/button>/);
    expect(form.indexOf('用 Face ID 登入')).toBeGreaterThan(form.indexOf('type="submit"'));
    expect(html).not.toContain('passkey_requested');
  });

  it('按鈕名稱跟著 biometry', async () => {
    expect(await openLogin('&biometry=touchid')).toContain('用 Touch ID 登入');
    expect(await openLogin('&biometry=opticid')).toContain('用 Optic ID 登入');
  });

  it('按鈕文字前有各自的圖示(跟 web 同一套 lucide):Face ID 掃臉、Touch ID 指紋、Optic ID 掃眼，圖示 aria-hidden', async () => {
    // lucide-static 0.460.0 的 scan-face、fingerprint、scan-eye 各取一段獨有的 path
    const ICONS: Record<string, string> = {
      faceid: 'M8 14s1.5 2 4 2 4-2 4-2',
      touchid: 'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
      opticid: 'M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0',
    };
    const LABELS: Record<string, string> = { faceid: 'Face ID', touchid: 'Touch ID', opticid: 'Optic ID' };
    for (const biometry of Object.keys(ICONS)) {
      const html = await openLogin(`&biometry=${biometry}`);
      const button = html.match(/<button [^>]*class="alt-btn"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
      expect(button).toMatch(/^<svg [^>]*aria-hidden="true"/);
      expect(button).toContain(ICONS[biometry]);
      for (const other of Object.keys(ICONS).filter((b) => b !== biometry)) {
        expect(button).not.toContain(ICONS[other]);
      }
      expect(button.indexOf('</svg>')).toBeLessThan(button.indexOf(`用 ${LABELS[biometry]} 登入`));
    }
  });

  it('沒帶、none 或不認得的 biometry:不顯示按鈕', async () => {
    for (const extra of ['', '&biometry=none', '&biometry=%3Cscript%3E', '&biometry=toString', '&biometry=constructor']) {
      expect(await openLogin(extra)).not.toContain('alt-btn"');
    }
  });

  it('註冊頁不顯示生物辨識按鈕', async () => {
    expect(await openLogin('&biometry=faceid&mode=register')).not.toContain('alt-btn"');
  });

  it('font_scale 放大整頁字級，範圍夾在 1～3.1,不合法當 1', async () => {
    expect(await openLogin('&font_scale=2')).toContain('html { font-size: 200%; }');
    expect(await openLogin('&font_scale=9')).toContain('html { font-size: 310%; }');
    expect(await openLogin('&font_scale=0.5')).toContain('html { font-size: 100%; }');
    expect(await openLogin('&font_scale=abc')).toContain('html { font-size: 100%; }');
    expect(await openLogin('')).toContain('html { font-size: 100%; }');
  });

  it('其餘字級用 rem,不寫死 px', async () => {
    const html = await openLogin('');
    expect(html).not.toMatch(/font-size:\s*\d+px/);
  });

  it('切換登入／註冊／忘記密碼時保留 biometry 與 font_scale', async () => {
    const html = decode(await openLogin('&biometry=faceid&font_scale=1.5'));
    const links = [...html.matchAll(/href="(\/oauth\/authorize\?[^"]+)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const p = new URL(`http://localhost${link}`).searchParams;
      expect(p.get('biometry')).toBe('faceid');
      expect(p.get('font_scale')).toBe('1.5');
    }
  });

  it('送出帳密失敗重新顯示時，按鈕與字級都還在', async () => {
    const html = await openLogin('&biometry=faceid&font_scale=2');
    // 照瀏覽器送出表單的方式：帶上表單裡所有隱藏欄位。
    const body = new URLSearchParams({ email: 'nobody-215@x.com', password: 'wrong-password' });
    for (const m of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) body.set(m[1], m[2]);
    expect(body.get('csrf_token')).toBeTruthy();
    const res = await rawFetch('/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    expect(res.status).toBe(401);
    const again = await res.text();
    expect(again).toContain('用 Face ID 登入');
    expect(again).toContain('html { font-size: 200%; }');
  });

  // 照瀏覽器送出表單的方式：帶上表單裡所有隱藏欄位，再加上按下的送出鈕。
  async function submitLogin(extra: string, fields: Record<string, string>) {
    const html = await openLogin(extra);
    const body = new URLSearchParams(fields);
    for (const m of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) body.set(m[1], m[2]);
    return rawFetch('/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async function registerUser(email: string) {
    await h.request('/auth/register', { method: 'POST', body: { email, password: 'password354', name: 'U354' } });
  }

  it('按生物辨識鈕、帳密正確：導回 redirect_uri 帶 code、state 與 biometric=1(#354)', async () => {
    await registerUser('bio-354@x.com');
    const res = await submitLogin('&biometry=faceid', { email: 'bio-354@x.com', password: 'password354', biometric: '1' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(`${location.protocol}${location.pathname}`).toBe(IOS_REDIRECT);
    expect(location.searchParams.get('code')).toBeTruthy();
    expect(location.searchParams.get('state')).toBe('st-215');
    expect(location.searchParams.get('biometric')).toBe('1');
  });

  it('按「登入」:導回不帶 biometric(#354)', async () => {
    await registerUser('plain-354@x.com');
    const res = await submitLogin('&biometry=faceid', { email: 'plain-354@x.com', password: 'password354' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('code')).toBeTruthy();
    expect(location.searchParams.has('biometric')).toBe(false);
  });

  it('註冊送出時夾帶 biometric=1 也不帶回(只有登入模式有效)', async () => {
    const res = await submitLogin('&biometry=faceid&mode=register', { email: 'reg-354@x.com', password: 'password354', name: 'R354', biometric: '1' });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')!).searchParams.has('biometric')).toBe(false);
  });

  it('按生物辨識鈕、帳密錯誤:401 重新顯示，按鈕與字級還在(#354)', async () => {
    const res = await submitLogin('&biometry=faceid&font_scale=2', { email: 'nobody-354@x.com', password: 'wrong', biometric: '1' });
    expect(res.status).toBe(401);
    const again = await res.text();
    expect(again).toContain('用 Face ID 登入');
    expect(again).toContain('html { font-size: 200%; }');
  });
});
