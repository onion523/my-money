function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND_LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="mm-logo-bg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--logo-bg-start)"/>
      <stop offset="1" stop-color="var(--logo-bg-end)"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mm-logo-bg)" stroke="var(--logo-border)" stroke-width="1.5"/>
  <path d="M32 33C29 29.8 23.5 28.5 14 29.2C12.3 29.3 11 30.7 11 32.4V47.6C11 49.4 12.5 50.8 14.3 50.6C23.5 49.8 29 51 32 53.5" fill="var(--logo-pink-soft)" stroke="var(--logo-pink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 33C35 29.8 40.5 28.5 50 29.2C51.7 29.3 53 30.7 53 32.4V47.6C53 49.4 51.5 50.8 49.7 50.6C40.5 49.8 35 51 32 53.5" fill="var(--logo-blue-soft)" stroke="var(--logo-blue)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 33V53.5" stroke="var(--logo-pink)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M16.5 36.5H25.5M16.5 42H23.5" stroke="var(--logo-pink)" stroke-width="2" stroke-opacity="0.55" stroke-linecap="round"/>
  <path d="M38.5 36.5H47.5M40.5 42H47.5" stroke="var(--logo-blue)" stroke-width="2" stroke-opacity="0.65" stroke-linecap="round"/>
  <path d="M25.5 23.8C25.5 23.8 19.6 20 19.6 16.2C19.6 14.3 21.1 12.9 22.9 12.9C24 12.9 25 13.5 25.5 14.5C26 13.5 27 12.9 28.1 12.9C29.9 12.9 31.4 14.3 31.4 16.2C31.4 20 25.5 23.8 25.5 23.8Z" fill="var(--logo-pink-soft)" stroke="var(--logo-pink)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="41.5" cy="18" r="7.5" fill="var(--logo-gold-soft)" stroke="var(--logo-gold)" stroke-width="2.3"/>
  <path d="M41.5 14.2V21.8M43.4 16.1C42.9 15.5 42.2 15.3 41.5 15.3C40.3 15.3 39.7 15.9 39.7 16.6C39.7 17.4 40.3 17.8 41.5 18.1C42.7 18.4 43.4 18.8 43.4 19.6C43.4 20.4 42.7 21 41.5 21C40.6 21 39.9 20.6 39.5 20" stroke="var(--logo-gold)" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const SHARED_CSS = `
:root {
  --bg: linear-gradient(135deg, #fff5f5 0%, #ffe8ea 50%, #eef7fb 100%);
  --card: rgba(255, 255, 255, 0.86);
  --border: rgba(255, 190, 190, 0.65);
  --text: #2d2628;
  --muted: #6f6266;
  --primary: #ff7b7b;
  --primary-hover: #f06565;
  --input-bg: rgba(255, 255, 255, 0.92);
  --error-bg: rgba(239, 68, 68, 0.1);
  --error-text: #c81e1e;
  --notice-bg: rgba(16, 185, 129, 0.12);
  --notice-text: #047857;
  --shadow: 0 20px 50px rgba(255, 138, 138, 0.16);
  --logo-bg-start: #fff9f8;
  --logo-bg-end: #fff1eb;
  --logo-border: #ffdede;
  --logo-pink: #f27979;
  --logo-pink-soft: rgba(255, 138, 138, 0.14);
  --logo-blue: #66b4d6;
  --logo-blue-soft: rgba(168, 216, 234, 0.22);
  --logo-gold: #eb9e38;
  --logo-gold-soft: rgba(255, 212, 160, 0.38);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: linear-gradient(135deg, #121318 0%, #1a1c24 60%, #151923 100%);
    --card: rgba(28, 31, 40, 0.86);
    --border: rgba(255, 255, 255, 0.12);
    --text: #f3f4f6;
    --muted: #a1a7b3;
    --primary: #ff8a8a;
    --primary-hover: #ff7070;
    --input-bg: rgba(18, 20, 27, 0.85);
    --error-bg: rgba(248, 113, 113, 0.14);
    --error-text: #fca5a5;
    --notice-bg: rgba(52, 211, 153, 0.14);
    --notice-text: #6ee7b7;
    --shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    --logo-bg-start: #252b33;
    --logo-bg-end: #1e232a;
    --logo-border: #3b434f;
    --logo-pink: #ff9a9a;
    --logo-pink-soft: rgba(255, 154, 154, 0.14);
    --logo-blue: #92d0e8;
    --logo-blue-soft: rgba(146, 208, 232, 0.14);
    --logo-gold: #f9c46b;
    --logo-gold-soft: rgba(249, 196, 107, 0.18);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
  background: var(--bg);
  color: var(--text);
}
.card {
  width: 100%;
  max-width: 25rem;
  padding: 28px 24px;
  border-radius: 22px;
  background: var(--card);
  border: 1px solid var(--border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.logo {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
h1 { margin: 0; font-size: 1.25rem; font-weight: 700; }
.sub { margin: 0 0 20px; font-size: 0.8125rem; color: var(--muted); }
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  margin-bottom: 18px;
}
.tab {
  display: block;
  text-align: center;
  padding: 8px 10px;
  border-radius: 9px;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
}
.tab.active {
  background: var(--primary);
  color: #fff;
}
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 6px;
}
input[type="email"],
input[type="password"],
input[type="text"] {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  font-size: 1rem;
  margin-bottom: 14px;
  outline: none;
}
input:focus { border-color: var(--primary); }
button {
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: 12px;
  background: var(--primary);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
}
button:hover { background: var(--primary-hover); }
button:disabled { opacity: 0.7; cursor: wait; }
.err {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--error-bg);
  color: var(--error-text);
  font-size: 0.8125rem;
  margin-bottom: 14px;
}
.notice {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--notice-bg);
  color: var(--notice-text);
  font-size: 0.8125rem;
  margin-bottom: 14px;
}
.aux-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 0.8125rem;
}
.aux-links.end {
  justify-content: flex-end;
}
.aux-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
}
.aux-link:hover { text-decoration: underline; }
.hint {
  margin-top: 14px;
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
}
.or {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.or::before, .or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
.alt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  font-size: 0.9375rem;
  font-weight: 700;
  text-decoration: none;
}
.alt-btn:hover { border-color: var(--primary); background: var(--input-bg); }
.alt-btn svg { width: 1.4em; height: 1.4em; flex: none; }
`;

/** iOS 在 `GET /oauth/authorize` 帶來的外觀參數(#215)。 */
export type Biometry = 'faceid' | 'touchid' | 'opticid';

export interface LoginDisplay {
  /** 有值才顯示「用 Face ID 登入」;沒帶、`none` 或不認得都是 undefined。 */
  biometry?: Biometry;
  /** 整頁字級倍數,1～3.1。 */
  fontScale: number;
}

const BIOMETRY_LABELS: Record<Biometry, string> = {
  faceid: 'Face ID',
  touchid: 'Touch ID',
  opticid: 'Optic ID',
};


// 圖示跟 web 前端同一套:lucide-static 0.460.0(ISC)的 scan-face、fingerprint、scan-eye,inline 是因為 CSP 沒有 img-src。
const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const SCAN_FRAME = '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>';
const FACE_ID_ICON = `${SVG_OPEN}${SCAN_FRAME}<path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>`;
const TOUCH_ID_ICON = `${SVG_OPEN}<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>`;
const OPTIC_ID_ICON = `${SVG_OPEN}${SCAN_FRAME}<circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/></svg>`;
const BIOMETRY_ICONS: Record<Biometry, string> = {
  faceid: FACE_ID_ICON,
  touchid: TOUCH_ID_ICON,
  opticid: OPTIC_ID_ICON,
};

const MIN_FONT_SCALE = 1;
const MAX_FONT_SCALE = 3.1;

export function parseLoginDisplay(biometry: string | null | undefined, fontScale: string | null | undefined): LoginDisplay {
  const scale = Number.parseFloat(fontScale ?? '');
  return {
    biometry: biometry && Object.prototype.hasOwnProperty.call(BIOMETRY_LABELS, biometry) ? (biometry as Biometry) : undefined,
    fontScale: Number.isFinite(scale) ? Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, scale)) : MIN_FONT_SCALE,
  };
}

/** 切換模式的連結與表單要帶著的外觀參數。 */
export function loginDisplayParams(display: LoginDisplay): Record<string, string> {
  const params: Record<string, string> = {};
  if (display.biometry) params.biometry = display.biometry;
  if (display.fontScale !== MIN_FONT_SCALE) params.font_scale = String(display.fontScale);
  return params;
}

export type OAuthLoginMode = 'login' | 'register' | 'forgot' | 'reset';

const MODE_TITLES: Record<OAuthLoginMode, string> = {
  login: '登入',
  register: '註冊帳號',
  forgot: '忘記密碼',
  reset: '重設密碼',
};

const MODE_BUTTONS: Record<OAuthLoginMode, { idle: string; busy: string }> = {
  login: { idle: '登入', busy: '登入中...' },
  register: { idle: '建立帳號並繼續', busy: '建立帳號中...' },
  forgot: { idle: '發送驗證碼', busy: '發送中...' },
  reset: { idle: '重設密碼', busy: '重設中...' },
};

export function renderOAuthLoginPage(opts: {
  csrfToken: string;
  mode?: OAuthLoginMode;
  email?: string;
  name?: string;
  error?: string;
  notice?: string;
  clientLabel?: string;
  switchUrlBase?: string;
  scriptNonce?: string;
  display?: LoginDisplay;
}): string {
  const display = opts.display ?? { fontScale: MIN_FONT_SCALE };
  const mode: OAuthLoginMode = opts.mode ?? 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const isAuthTab = mode === 'login' || isRegister;
  const emailVal = escapeHtml(opts.email || '');
  const nameVal = escapeHtml(opts.name || '');
  const csrfVal = escapeHtml(opts.csrfToken);
  const clientText = opts.clientLabel ? `正在登入 ${escapeHtml(opts.clientLabel)}` : '個人與家庭雙帳本';

  const tabsHtml =
    opts.switchUrlBase && isAuthTab
      ? `<div class="tabs">
        <a class="tab${!isRegister ? ' active' : ''}" href="${escapeHtml(opts.switchUrlBase)}&mode=login">登入</a>
        <a class="tab${isRegister ? ' active' : ''}" href="${escapeHtml(opts.switchUrlBase)}&mode=register">註冊新帳號</a>
      </div>`
      : '';

  const nameField = isRegister
    ? `<label for="name">顯示名稱</label>
       <input id="name" name="name" type="text" autocomplete="name" required value="${nameVal}" placeholder="例如：小華">`
    : '';

  const otpField = isReset
    ? `<label for="code">6 位數驗證碼</label>
       <input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required placeholder="請輸入機器人收到的 6 位數驗證碼">`
    : '';

  const passwordField = !isForgot
    ? `<label for="password">${isReset ? '新密碼' : '密碼'}</label>
       <input id="password" name="password" type="password" autocomplete="${isRegister || isReset ? 'new-password' : 'current-password'}" ${isRegister || isReset ? 'minlength="6"' : ''} required placeholder="${isRegister || isReset ? '至少 6 個字元' : '請輸入密碼'}">`
    : '';

  let auxLinksHtml = '';
  if (opts.switchUrlBase) {
    const base = escapeHtml(opts.switchUrlBase);
    if (mode === 'login') {
      auxLinksHtml = `<div class="aux-links end"><a class="aux-link" href="${base}&mode=forgot">忘記密碼？</a></div>`;
    } else if (isForgot) {
      auxLinksHtml = `<div class="aux-links"><a class="aux-link" href="${base}&mode=login">← 返回登入</a><a class="aux-link" href="${base}&mode=reset">已有驗證碼？前往重設</a></div>`;
    } else if (isReset) {
      auxLinksHtml = `<div class="aux-links"><a class="aux-link" href="${base}&mode=login">← 返回登入</a><a class="aux-link" href="${base}&mode=forgot">重新發送驗證碼</a></div>`;
    }
  }

  const btnText = MODE_BUTTONS[mode];

  const displayInputs = Object.entries(loginDisplayParams(display))
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join('');

  // 登入鈕下方隔一條「或」,再放描邊的生物辨識送出鈕：一樣驗帳密，成功導回時多帶 biometric=1,由 App 綁定生物辨識(#354)。
  const biometricHtml =
    mode === 'login' && display.biometry
      ? `<div class="or">或</div>
      <button type="submit" name="biometric" value="1" class="alt-btn">${BIOMETRY_ICONS[display.biometry]}用 ${BIOMETRY_LABELS[display.biometry]} 登入</button>`
      : '';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${MODE_TITLES[mode]} — My Money</title>
  <style>${SHARED_CSS}
html { font-size: ${Math.round(display.fontScale * 100)}%; }</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">${BRAND_LOGO_SVG}</div>
      <div>
        <h1>My Money</h1>
        <p class="sub">${clientText}</p>
      </div>
    </div>
    ${tabsHtml}
    ${opts.notice ? `<div class="notice" role="status">${escapeHtml(opts.notice)}</div>` : ''}
    ${opts.error ? `<div class="err" role="alert">${escapeHtml(opts.error)}</div>` : ''}
    <form method="post" action="/oauth/authorize">
      <input type="hidden" name="csrf_token" value="${csrfVal}">
      <input type="hidden" name="mode" value="${mode}">
      ${displayInputs}
      ${nameField}
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required value="${emailVal}" placeholder="you@example.com">
      ${otpField}
      ${passwordField}
      <button type="submit">${btnText.idle}</button>
      ${biometricHtml}
    </form>
    ${auxLinksHtml}
    <p class="hint">安全驗證由 My Money 授權伺服器提供</p>
  </main>${
    opts.scriptNonce
      ? `
  <script nonce="${escapeHtml(opts.scriptNonce)}">
    (function(){
      var f = document.querySelector('form');
      if (!f) return;
      var sent = false;
      f.addEventListener('submit', function(e){
        if (sent) { e.preventDefault(); return; }
        sent = true;
        var b = e.submitter;
        if (b && !b.name) b.textContent = '${btnText.busy}';
        // 延後才停用：同步停用會讓按下的鈕不進表單資料,biometric=1 就送不出去。
        setTimeout(function(){
          f.querySelectorAll('button').forEach(function(x){ x.disabled = true; });
        });
      });
    })();
  </script>`
      : ''
  }
</body>
</html>`;
}

export function renderOAuthErrorPage(title: string, message: string, backUrl?: string): string {
  const actionHtml = backUrl
    ? `<a href="${escapeHtml(backUrl)}" style="display:block;text-align:center;padding:12px;border-radius:12px;background:var(--primary);color:#fff;text-decoration:none;font-weight:700;margin-top:12px;">返回 My Money 重新登入</a>`
    : `<p class="hint">請回到原本的應用程式重新發起登入。</p>`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — My Money</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">${BRAND_LOGO_SVG}</div>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="sub">授權請求無法完成</p>
      </div>
    </div>
    <div class="err" role="alert">${escapeHtml(message)}</div>
    ${actionHtml}
  </main>
</body>
</html>`;
}
