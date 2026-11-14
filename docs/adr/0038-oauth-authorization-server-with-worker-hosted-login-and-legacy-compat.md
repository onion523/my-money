# ADR 0038: 改用 OAuth 2.1 授權碼 + PKCE，登入頁放在 Worker，並保留相容模式給舊版 iOS

## 狀態 (Status)
已接受 (Accepted) — 2026-11-14（對應 issue #194）

## 背景與問題 (Context & Problem)
目前 `/auth/login` 直接回傳效期 30 天的 HS256 JWT，有三個問題：
- 沒有 refresh token，也沒有撤銷機制和裝置清單；
- web 和 API 不在同一個網域（Cloudflare Pages 對 `*.workers.dev`）；
- 匯出 CSV 時，JWT 直接寫在網址的 `?token=` 裡。

另外，密碼只是加鹽後做一次 SHA-256，登入也沒有任何次數限制。

目前只有自家的 web 和 iOS 兩個 client，所以其實可以用更簡單的「帳密 API + refresh token」解決。但我們還是選擇做完整的 OAuth 2.1 授權伺服器，理由是：
- iOS 改用 `ASWebAuthenticationSession` 後，app 完全碰不到密碼；
- passkey（#192）只需要在單一網域上的登入頁實作一次；
- 日後要接第三方時，不需要再改一次架構。

## 決策 (Decision)
1. **完整的授權碼 + PKCE（S256）流程**。web 與 iOS 都重導到 `GET /oauth/authorize`。端點包括 `/oauth/token`（`authorization_code`、`refresh_token`）、`/oauth/revoke`、`/.well-known/oauth-authorization-server`。scope 目前只有一個 `full`，middleware 先不依 scope 限制路由。
2. **登入頁由 Worker 產生**：
   - 單一個自帶 CSS 的靜態 HTML，繁體中文，依 `prefers-color-scheme` 切換深淺色；
   - 同一頁可以切換「登入」和「註冊」，註冊成功就直接當作已登入並發 code；
   - 安全設定：嚴格 CSP、`frame-ancestors 'none'`、CSRF token。
   
   **授權伺服器不會用長效 cookie 記住使用者**，只用短效 cookie 串起「登入表單 → 發 code」。因此每次走 authorize 都要重新驗證身分，登出就等於撤銷 Session。
3. **Client 寫死在程式裡**，不建 `oauth_clients` 表：
   - `web`：redirect 到正式 Pages 網域的 `/oauth/callback`（由環境變數設定），開發環境另外允許 `http://localhost:5173/oauth/callback`；
   - `ios`：使用自訂 scheme `com.raychiu.mymoney:/oauth/callback`。
4. **Token**：
   - Access Token 效期 15 分鐘，是 stateless JWT，內含 `sid`、`client_id`、`scope`。middleware 不查 D1，所以撤銷後最多還有 15 分鐘空窗期。
   - Refresh Token 是不透明字串，D1 只存雜湊值，每次使用都會輪替。舊 token 在 30 秒內再被使用時，回傳同一組新 token（冪等）；超過 30 秒才判定為重用，並撤銷整個 Session。
   - Session 閒置 30 天就過期（滑動效期），沒有絕對上限。
   - `token_type` 先用 `Bearer`，sessions 表預留可為 null 的 `dpop_jkt` 欄位。DPoP 留給 #193。
5. **web 的存放方式**：Access Token 只放在記憶體，Refresh Token 放在 localStorage。用 Web Locks 讓多個分頁同時只有一個 refresh 請求。CSV 匯出改成 fetch 帶 `Authorization` header 下載成 Blob；新的 Access Token 一律不接受 `?token=`。
6. **裝置清單**：後端依 User-Agent 自動產生裝置名稱，記錄建立時間、最後使用時間和 client。web 設定頁可以登出單一裝置，或「登出其他所有裝置」。不提供重新命名，也不記錄 IP。
7. **修改密碼（新功能）**：需要輸入舊密碼與新密碼。改完後撤銷其他 Session，目前這台保持登入，同時讓 Legacy Token 失效。忘記密碼不在本次範圍內。
8. **密碼雜湊改用 PBKDF2-SHA256**（10 萬次迭代），以帶版本的格式儲存。舊帳號在下次登入成功時自動重新雜湊。
9. **登入次數限制**（用 D1 計數）：
   - 同一個 Email 連續失敗 5 次，鎖定 15 分鐘；
   - 同一個 IP 在 15 分鐘內失敗 20 次，暫停受理；
   - 錯誤訊息一律顯示「Email 或密碼錯誤」，不透露帳號是否存在；
   - 修改密碼時的舊密碼驗證也套用同一套規則。
10. **相容模式**：
    - `/auth/login`、`/auth/register` 和 Legacy Token（30 天、可用 `?token=`）照舊運作，不列入裝置清單；
    - 修改密碼時，用 `users.legacy_token_valid_after` 讓 Legacy Token 失效（只有沒有 `sid` 的舊格式 token 才會多查一次 D1）；
    - 可用環境變數 `LEGACY_AUTH_ENABLED` 整個關閉相容模式；等 iOS 新版普及後，另開 issue 移除相關程式碼。
11. **web 升級時**：如果瀏覽器裡還有舊的 `mm_token`，直接清除並導去重新登入一次。不提供「用舊 token 換新 Session」的交換端點。

## 考慮過的替代方案 (Alternatives)
- **只做帳密 API + refresh token**：改動較少，但 app 仍會接觸到密碼，passkey 也要在 web 和 iOS 各實作一次。
- **登入頁放在 web SPA**：可以沿用 React 的畫面風格，但登入 UI 和授權伺服器會在不同網域，passkey 的 RP ID 和跨站 cookie 都會變複雜。
- **用 HttpOnly cookie 存 Refresh Token**：因為跨網域，這個 cookie 對 web 來說是第三方 cookie，Safari／WebKit 會擋掉；要用就得先購買自訂網域並改為 BFF 架構。

## 後果 (Consequences)
- 所有現有的 web 使用者在升級時都需要重新登入一次。
- 舊版 iOS 在相容期間的安全性和現在一樣，只有修改密碼這一點有改善。
- 每個 API 請求的成本不變（不查 D1）；只有 Legacy Token 和 refresh 會多查一次 D1。
