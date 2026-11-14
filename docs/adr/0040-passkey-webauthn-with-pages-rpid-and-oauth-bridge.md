# ADR 0040: Passkey（WebAuthn）採用前端網域 RP ID 搭配 OAuth 授權橋接與 iOS 過渡雙軌

## 狀態 (Status)
已接受 (Accepted) — 2026-11-14（對應 issue #192，更新原 Spec 以整合 #194 OAuth 2.1 與 #193 DPoP）

## 背景與問題 (Context & Problem)
#192 原 Spec 撰寫於 #194（OAuth 2.1）與 #193（DPoP）之前，原設計假設 `POST /auth/passkey/login/verify` 直接回傳 30 天 Legacy Token。
此外，目前 Web 前端部署於 `my-money-onion.pages.dev`，而 OAuth 授權頁在 `my-money-api.onion523.workers.dev`；`pages.dev` 與 `workers.dev` 皆位於 Public Suffix List（PSL）上，兩者無法共用同一個 WebAuthn `rpId`。

## 決策 (Decision)
1. **RP ID 固定為前端網域**：正式環境 `RP ID` 為 `my-money-onion.pages.dev`（`origin` 為 `https://my-money-onion.pages.dev`，本地開發為 `localhost` / `http://localhost:5173`，並可由環境變數覆寫）。Passkey 註冊（設定頁）與登入（前端登入頁）皆在前端網域執行，無需額外設定自訂網域。
2. **雙軌核發 Token**：
   - **Web（OAuth 2.1 + PKCE + DPoP）**：新增 `POST /oauth/passkey/authorize`，接收 Passkey assertion 與 PKCE 參數（`client_id`、`redirect_uri`、`code_challenge`、`code_challenge_method=S256`、`state`），驗證 assertion 與單次 D1 challenge 後核發授權碼 `code`；前端再走既有 `POST /oauth/token`（附 DPoP proof）換取 15 分鐘 Access Token、輪替 Refresh Token 與 Session。
   - **iOS 過渡相容**：保留 `POST /auth/passkey/login/verify` 回傳 `{ token, user }`（Legacy Token），受 `LEGACY_AUTH_ENABLED !== 'false'` 控制；待 iOS 切換至 OAuth 後一併隨相容模式退場。
3. **Passkey 生命週期與安全檢查**：
   - 使用 `@simplewebauthn/server`（後端）與 `@simplewebauthn/browser`（前端）。
   - `users` 表新增 `webauthn_user_id`（隨機 handle，不含個資，同一帳號跨裝置註冊共用同一 handle）。
   - `webauthn_challenges` 存於 D1（單次使用、5 分鐘 TTL）。
   - `passkeys` 表存 `credential_id`（unique）、`public_key`、`sign_count`、`transports`、`name`、`created_at`、`last_used_at`，`user_id` 設定 `ON DELETE CASCADE`。
   - 驗證 `sign_count`：若舊值 `> 0` 且新值 `<= 舊值` 則拒絕（防複製認證器）；同為 `0` 則放行（相容 iCloud 鑰匙圈等同步 Passkey）。
   - 刪除 Passkey 僅停用該憑證未來登入，不主動撤銷既有 OAuth Session。
4. **iOS AASA 預留**：在 `web/public/.well-known/apple-app-site-association` 與 Cloudflare Pages `_headers` 預留 `webcredentials` 結構與 `application/json` 標頭，待提供 Apple Team ID 後填入。

## 後果 (Consequences)
- 正面：不需購買自訂網域即可同時支援 Web 與 iOS Passkey；Web 登入依然保有 OAuth 2.1、PKCE 與 DPoP 保護；既有密碼與 iOS 相容流程不受影響。
- 負面：Passkey 登入按鈕放在前端登入頁而非 Worker `/oauth/authorize` 頁，未來若切換至共用主網域可再整合進統一授權頁。
- 難以反轉：`RP ID`（`my-money-onion.pages.dev`）一旦讓使用者註冊 Passkey 後不可輕易更換，否則既有 Passkey 無法在新網域使用。
