# ADR 0039: DPoP（RFC 9449）僅綁定 OAuth Session，分階段導入且不碰 Legacy Token

## 狀態 (Status)
已接受 (Accepted) — 2026-11-14（對應 issue #193，取代原 Spec 中與 #194 衝突的前提）

## 背景與問題 (Context & Problem)
#193 原 Spec 撰寫於 #194（OAuth 2.1）之前，假設 token 是 30 天 HS256 bearer、沒有 refresh。#194 完成後，web 使用 15 分鐘 Access Token + 輪替 Refresh Token，`sessions` 表已預留 `dpop_jkt` 欄位，web CSV 匯出也已改用 `fetch` 加 header。bearer token 外洩（XSS、log、備份）在效期內仍可被冒用，Refresh Token 外洩影響更久。

## 決策 (Decision)
1. **綁定在 Session**：`POST /oauth/token`（領碼）驗證 DPoP proof，將 JWK thumbprint 寫入 `sessions.dpop_jkt`；Access Token 帶 `cnf.jkt`，回應 `token_type: "DPoP"`。`grant_type=refresh_token` 必須用同一把金鑰簽 proof；同一 Session 不允許換金鑰。
2. **分階段、新舊並行**：①後端支援（沒帶 `DPoP` header 時仍核發未綁定 Session，行為與現行相同，iOS 不受影響）②web 先接上，iOS 之後再接 ③環境變數 `DPOP_REQUIRED=true` 後拒絕未綁定 Session 與 Bearer 使用綁定 token。
3. **jti 重送防護**：D1 `dpop_jti` 表（唯一鍵），保留 2 分鐘。token 端點與寫入類請求（POST/PUT/DELETE）強制；GET 只靠 `iat ±60 秒` + `ath` 綁定，避免每次讀取多一次 D1 寫入。
4. **時鐘容忍**：一律 `iat ±60 秒`；超出時回 401 `invalid_dpop_proof` 並帶 `Date`，client 依 `Date` 估算時鐘差後自動重試一次，失敗再提示、不登出。token 錯誤/過期回 `invalid_token`，兩者必須可分辨。
5. **Web 金鑰**：每次登入產生新的 ES256 non-extractable 金鑰存 IndexedDB；登出與登入失敗時刪除；遺失視為需重新登入。
6. **不做**：舊 `/auth/login`、`/auth/register`、Legacy Token 不加 DPoP（相容模式結束即淘汰）；`DPoP-Nonce`、非對稱簽章 JWT 不在範圍。`?token=` 路徑隨 `LEGACY_AUTH_ENABLED=false` 一併消失。
7. 驗證項目沿用 RFC 9449：`typ=dpop+jwt`、僅 ES256、`jwk` 為不含私鑰欄位的公鑰、`htm`/`htu`/`ath`/`jkt` 相符。CORS `allowHeaders` 加 `DPoP`。

## 後果 (Consequences)
- 正面：外洩的 Access/Refresh Token 在沒有私鑰時無法使用；不依賴 cookie；升級期間舊 client 不會被登出。
- 負面：寫入類請求每次多一次 D1 寫入（jti）；web 清除瀏覽器資料後必須重新登入；iOS 之後需用 Secure Enclave 實作 proof。
- 難以反轉：`sessions.dpop_jkt` 語意與 `token_type` 一旦對外，client 契約即固定。
