# ADR 0042: OAuth 登入頁原生通行金鑰切換（`passkey_requested`）與 iOS 字級縮放契約

## 狀態 (Status)
已接受 (Accepted) — 2026-11-15（對應 Issue #215、PR #216，延伸 ADR 0038 與 ADR 0040）

## 背景與問題 (Context & Problem)
iOS Client 切換至 OAuth 2.1（ADR 0038）後，登入流程透過系統登入視窗開啟授權伺服器的 `GET /oauth/authorize` 頁面。該頁面原本存在兩個問題：
1. **缺少生物辨識（Passkey）入口**：已建立 Passkey（ADR 0040）的 iOS 使用者在登入頁只能看到 Email 與密碼表單，無法直接切換回系統通行金鑰登入。由於授權伺服器位於 `workers.dev` 而 Passkey RP ID 綁定在 `my-money-onion.pages.dev`，授權頁無法直接呼叫 WebAuthn。
2. **未跟隨系統無障礙字級**：授權頁樣式原先寫死 `px` 字級，iOS 使用者開啟大字級或無障礙字級時無法等比放大。

## 決策 (Decision)
1. **顯式 `biometry` 才顯示生物辨識入口**：
   - `GET /oauth/authorize` 接收選填參數 `biometry`（僅接受 `faceid`、`touchid`、`opticid`）。
   - 僅在 `mode === 'login'` 且 `biometry` 為合法值時，於主登入按鈕下方顯示「或」分隔線與描邊按鈕「用 Face ID／Touch ID／Optic ID 登入」。
   - **省略 `biometry`、`biometry=none` 或任何不認得的值一律不顯示按鈕**（較 Issue #215 原案「未傳時顯示『用通行金鑰登入』」更保守），以確保不會讓不處理 `passkey_requested` 的 Web Client 誤觸導回。
2. **以 `error=passkey_requested` 導回 App 切換原生 Passkey**：
   - 點擊該按鈕不於 Worker 頁面執行 WebAuthn，而是直接導向 `redirect_uri?error=passkey_requested&error_description=...&state=...`，作廢該次授權請求。
   - iOS Client 收到 `error=passkey_requested`（並驗證 `state`）後關閉系統登入視窗，改走原生系統通行金鑰與既有的 `POST /oauth/passkey/authorize`。
3. **動態字級縮放（`font_scale`）**：
   - `GET /oauth/authorize` 接收選填參數 `font_scale`，夾限於 `1`～`3.1`（不合法或未傳視為 `1`），套用於根元素 `html { font-size: ...% }`。
   - 登入頁字體、`max-width` 與 `.logo` 改用 `rem` 隨 `font_scale` 放大；`padding` 與 `margin` 維持 `px` 以避免極端 3.1x 字級下留白過度擠壓行動端可視寬度。
4. **狀態保留**：
   - `biometry` 與 `font_scale` 屬於純外觀參數，不寫入 `oauth_tx`；於切換登入／註冊／忘記密碼連結及表單隱藏欄位中保留，確保表單驗證失敗重繪時不遺失。

## 後果 (Consequences)
- **正面**：無需變更 Passkey RP ID 或新增跨網域 WebAuthn 橋接，即可讓 iOS 在 OAuth 登入視窗內順暢切回系統 Passkey，並支援 iOS Dynamic Type。
- **負面**：使用者點擊「用 Face ID 登入」會先觸發一次 OAuth 錯誤導回並關閉視窗，再由原生端發起 Passkey 驗證；若未來自訂網域整合後，可再評估是否改為頁內直接驗證。
- **難以反轉**：`biometry`、`font_scale` 與 `error=passkey_requested` 屬於授權伺服器與已發布 iOS App 之間的公開契約，上線後不可隨意更名或改變語意。
