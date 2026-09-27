# 🚀 我的記帳本 — Cloudflare 雲端部署與機器人串接指南

本專案採用完全免費且高效能的 **Cloudflare 全球邊緣無伺服器架構**：
- **前端**：Cloudflare Pages（全球 CDN 加速、自動 HTTPS、SPA 路由支援）
- **後端 API**：Cloudflare Workers（毫秒級冷啟動、Hono 高效框架）
- **資料庫**：Cloudflare D1（全球分佈式 SQLite 邊緣資料庫）
- **智慧機器人**：LINE Messaging API + Telegram Bot Webhook 原生整合

---

## 📋 目錄
1. [一鍵快速部署（最推薦）](#1-一鍵快速部署最推薦)
2. [GitHub Actions 自動化持續部署 (CI/CD)](#2-github-actions-自動化持續部署-cicd)
3. [手動分步部署流程](#3-手動分步部署流程)
4. [LINE / Telegram 記帳機器人 Webhook 設定](#4-line--telegram-記帳機器人-webhook-設定)
5. [常見問題排查 (FAQ)](#5-常見問題排查-faq)

---

## 1. 一鍵快速部署（最推薦）

專案根目錄已為您準備好自動化一鍵部署腳本：

### Windows 使用者
開啟 PowerShell 執行：
```powershell
.\deploy.ps1
```

### macOS / Linux 使用者
開啟 Terminal 執行：
```bash
chmod +x deploy.sh
./deploy.sh
```

腳本將會自動：
1. 檢查並引導登入 Cloudflare 帳號
2. 建立/同步遠端 Cloudflare D1 資料庫
3. 部署 Workers 後端 API
4. 打包前端並部署至 Cloudflare Pages

---

## 2. GitHub Actions 自動化持續部署 (CI/CD)

專案已內建 `.github/workflows/deploy.yml`。只要將專案推送到 GitHub 的 `main` 分支，即可自動觸發建置與部署。

### 步驟：
1. 在 GitHub 專案的 **Settings** -> **Secrets and variables** -> **Actions** 中新增以下 Repository Secrets：
   - `CLOUDFLARE_API_TOKEN`：在 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) 建立，權限包含：
     - *Account: Cloudflare Pages (Edit)*
     - *Account: Workers Scripts (Edit)*
     - *Account: D1 (Edit)*
   - `CLOUDFLARE_ACCOUNT_ID`：在 Cloudflare Dashboard 首頁右下角取得你的 Account ID。
   - `PRODUCTION_API_URL`：你的 Workers API 網址（例如 `https://my-money-api.your-subdomain.workers.dev`）。
2. `git push origin main` 即刻啟動自動部署！

---

## 3. 手動分步部署流程

如果你偏好逐步操作，請依照下列步驟：

### Step 1. 登入 Cloudflare
```bash
npx wrangler login
```

### Step 2. 建立雲端 D1 資料庫
```bash
cd backend
npx wrangler d1 create my-money-db
```
執行後終端機將會輸出類似如下資訊：
```toml
[[d1_databases]]
binding = "DB"
database_name = "my-money-db"
database_id = "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
請將 `database_id` 複製並填入 `backend/wrangler.toml` 的 `[env.production]` 區塊。

### Step 3. 執行資料庫 Schema 遷移
```bash
npx wrangler d1 execute my-money-db --remote --file=src/db/schema.sql
```

### Step 4. 設定後端密鑰 (Secrets)
```bash
npx wrangler secret put JWT_SECRET
# 輸入自訂的高強度密鑰字串
```
*(若有使用 LINE/Telegram 機器人，可繼續設定下列金鑰)*
```bash
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

### Step 5. 部署後端 API
```bash
npx wrangler deploy
```
部署完成後會得到你的專屬 API 網址，例如：`https://my-money-api.xxxx.workers.dev`。

### Step 6. 打包並部署前端 Pages
```bash
cd ../web
# 設定生產環境 API 網址 (Windows PowerShell)
$env:VITE_API_URL = "https://my-money-api.xxxx.workers.dev"
npm run build

# 部署至 Cloudflare Pages
npx wrangler pages deploy dist --project-name my-money
```

---

## 4. LINE / Telegram 記帳機器人 Webhook 設定

系統已具備完整的自然語言記帳解析核心（支援「午餐 120」、「計程車 250 信用卡」、「薪資 70000 銀行」、「查帳」等）。

### 🟢 LINE Messaging API 串接：
1. 登入 [LINE Developers Console](https://developers.line.biz/)，建立一個 **Provider** 與 **Messaging API Channel**。
2. 取得 **Channel Secret** 與 **Channel Access Token**（長期）。
3. 在 `backend` 執行：
   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   ```
4. 在 LINE Channel 設定中的 **Webhook URL** 填入：
   ```
   https://<你的-WORKERS-網址>/bot/webhook/line
   ```
5. 開啟「**Use Webhook**」開關，並關閉「Auto-reply messages（自動回覆）」。
6. 用手機加此 LINE Bot 為好友，至網頁版「**機器人記帳**」取得 6 位數配對碼，在 LINE 傳送 `綁定 123456` 即可啟用！

### 🔵 Telegram Bot 串接：
1. 在 Telegram 搜尋 `@BotFather`，輸入 `/newbot` 依提示建立機器人，取得 `HTTP API Token`。
2. 在 `backend` 執行：
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```
3. 設定 Telegram Webhook（在瀏覽器開啟或用 curl 執行）：
   ```bash
   curl "https://api.telegram.org/bot<你的-BOT-TOKEN>/setWebhook?url=https://<你的-WORKERS-網址>/bot/webhook/telegram"
   ```
4. 在 Telegram 私訊機器人發送 `綁定 <配對碼>` 即完成配對！

---

## 5. 常見問題排查 (FAQ)

### Q1: 前端重新整理頁面出現 404？
**A**: Cloudflare Pages 需要將未匹配路由重導向至 `index.html`。專案已在 `web/public/_redirects` 內建 `/* /index.html 200` 規則，只要重新部署前端即可解決。

### Q2: 前端呼叫 API 出現 CORS 錯誤？
**A**: 後端 `backend/src/index.ts` 的 CORS 設定已包含 `*.pages.dev` 與 `*.workers.dev`。若使用自訂網域，請至 `index.ts` 允許您的自訂網域。

### Q3: 機器人配對碼顯示過期？
**A**: 配對碼為了安全考量預設有效時間為 10 分鐘，如果過期，只要在網頁端「機器人記帳」重新點擊「產生配對碼」即可。