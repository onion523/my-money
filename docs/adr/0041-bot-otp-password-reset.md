# ADR 0041: 透過已綁定 LINE／Telegram 機器人發送 OTP 的忘記密碼重設機制

## 狀態 (Status)
已接受 (Accepted) — 2026-11-15

## 背景與問題 (Context & Problem)
在 ADR-0038 導入 OAuth 2.1 授權伺服器與 Worker 託管登入頁時，「忘記密碼」尚未納入範圍（僅支援已登入後的修改密碼）。當使用者忘記密碼且未設定 Passkey 時，無法自助恢復帳號存取權。

同時，本專案目前未串接任何外部寄信服務（無 Resend / SendGrid / SMTP 等設定與發信網域），但系統已具備穩定的 LINE 與 Telegram 機器人整合（`bot_bindings` 與對應推播憑證）。

## 決策 (Decision)
1. **以已綁定的 LINE / Telegram 機器人作為驗證碼（OTP）發送管道**：
   - 不額外引入外部 Email 寄信服務。
   - 使用者請求重設密碼時，系統查詢該 Email 對應帳號所有已綁定的機器人（`bot_bindings`），並**同時推播** 6 位數一次性驗證碼至所有已綁定的 LINE（Push API）與 Telegram（`sendMessage` API）。
   - 未綁定任何機器人的帳號無法透過此流程自助重設密碼（可視為已知限制，使用者可改用已設定的 Passkey 登入後修改密碼）。

2. **UI 入口集中於 Worker 託管的 OAuth 登入頁**：
   - 延續 ADR-0038「Authorization Server 登入頁為唯一輸入密碼處」的原則，忘記密碼流程（請求驗證碼、輸入驗證碼與新密碼）直接實作於 Worker 登入頁（`oauthLoginPage.ts`），讓 Web 與 iOS Client 皆可共用，無須各自維護重設畫面。
   - 整個流程保留原始 OAuth 授權參數（`client_id`、`redirect_uri`、`code_challenge`、`state` 等），並受既有 CSRF 機制保護。

3. **防帳號枚舉與防暴力破解規範**：
   - 請求發送驗證碼時，無論 Email 是否存在或是否已綁定機器人，畫面一律顯示**中性提示**（例如：「若該 Email 已註冊且有綁定 LINE 或 Telegram 機器人，驗證碼已發送至您的機器人」），不洩漏帳號存在與綁定狀態。
   - 驗證碼規格：6 位數數字（CSPRNG 產生），僅以雜湊值儲存於 D1，效期 **10 分鐘**，同一驗證碼最多試錯 **5 次**即作廢；重新發送會使舊驗證碼失效。
   - 速率限制：同 Email **60 秒**冷卻且 **15 分鐘內最多 3 次**；同 IP **15 分鐘內最多 10 次**。

4. **重設成功後全面撤銷既有登入狀態**：
   - 以 PBKDF2-SHA256（10 萬次迭代）寫入新密碼雜湊與新 salt。
   - **撤銷該使用者所有裝置的 `sessions`** 並更新 `users.legacy_token_valid_after` 使所有 Legacy Token 失效，同時清除該 Email 的登入失敗鎖定紀錄（`login_attempts`）。
   - **保留既有的 Passkey 憑證**（`passkey_credentials`）。
   - 重設成功後導回 Worker 登入表單（保留原 OAuth 參數並顯示成功提示），由使用者以新密碼重新登入取得授權碼，不自動登入繞過驗證。

## 考慮過的替代方案 (Alternatives)
- **串接第三方 Email 寄信服務（如 Resend）**：可覆蓋未綁定機器人的帳號，但需額外申請帳號、設定 DNS 發信網域驗證（SPF/DKIM）與管理 API Key Secret；本專案屬個人／家庭記帳系統，現有使用者皆已使用 LINE / Telegram 機器人記帳，優先複用既有 Bot 通道可將外部依賴降至零。
- **優先發送 Telegram 並略過 LINE**：雖可節省 LINE OA 每月免費推播額度，但部分使用者可能僅綁定 LINE 或習慣查看 LINE，同時發送至所有已綁定機器人可確保最可靠的觸達率。
- **重設後直接自動登入發放 OAuth Code**：雖少一次輸入密碼，但導回登入表單重新輸入新密碼可即時驗證密碼記憶與瀏覽器密碼管理器儲存，且流程與既有 OAuth 授權單純一致。

## 後果 (Consequences)
- 零外部寄信服務依賴與零額外網域設定成本，Web 與 iOS 同步獲得忘記密碼能力。
- 尚未綁定 LINE 或 Telegram 機器人的帳號在忘記密碼且無 Passkey 時，無法自助重設密碼；若未來需支援純 Email 使用者，可再擴充 Email 寄信作為第二通道。
- 每次透過 LINE 發送重設驗證碼會消耗一則 LINE OA 主動推播額度（Push Message）。
