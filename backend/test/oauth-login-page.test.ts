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

  it('帶 biometry=faceid:登入鈕下方有「用 Face ID 登入」,導回 App 並帶 passkey_requested 與原本的 state', async () => {
    const html = decode(await openLogin('&biometry=faceid'));
    expect(html).toContain('用 Face ID 登入');
    const href = html.match(/href="(com\.raychiu\.mymoney:\/oauth\/callback\?[^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    const params = new URL(href!).searchParams;
    expect(params.get('error')).toBe('passkey_requested');
    expect(params.get('state')).toBe('st-215');
    expect(html.indexOf('用 Face ID 登入')).toBeGreaterThan(html.indexOf('type="submit"'));
  });

  it('按鈕名稱跟著 biometry', async () => {
    expect(await openLogin('&biometry=touchid')).toContain('用 Touch ID 登入');
    expect(await openLogin('&biometry=opticid')).toContain('用 Optic ID 登入');
  });

  it('沒帶、none 或不認得的 biometry:不顯示按鈕', async () => {
    for (const extra of ['', '&biometry=none', '&biometry=%3Cscript%3E', '&biometry=toString', '&biometry=constructor']) {
      expect(await openLogin(extra)).not.toContain('passkey_requested');
    }
  });

  it('註冊頁不顯示生物辨識按鈕', async () => {
    expect(await openLogin('&biometry=faceid&mode=register')).not.toContain('passkey_requested');
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
});
