function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  max-width: 400px;
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
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 18px;
}
h1 { margin: 0; font-size: 20px; font-weight: 700; }
.sub { margin: 0 0 20px; font-size: 13px; color: var(--muted); }
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
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
}
.tab.active {
  background: var(--primary);
  color: #fff;
}
label {
  display: block;
  font-size: 13px;
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
  font-size: 16px;
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
  font-size: 15px;
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
  font-size: 13px;
  margin-bottom: 14px;
}
.notice {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--notice-bg);
  color: var(--notice-text);
  font-size: 13px;
  margin-bottom: 14px;
}
.aux-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
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
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
`;

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
}): string {
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

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${MODE_TITLES[mode]} — My Money</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">M</div>
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
      ${nameField}
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required value="${emailVal}" placeholder="you@example.com">
      ${otpField}
      ${passwordField}
      <button type="submit">${btnText.idle}</button>
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
      f.addEventListener('submit', function(e){
        var b = f.querySelector('button[type="submit"]');
        if (!b) return;
        if (b.disabled) { e.preventDefault(); return; }
        b.disabled = true;
        b.textContent = '${btnText.busy}';
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
      <div class="logo">M</div>
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
