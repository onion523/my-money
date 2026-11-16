# ADR 0043: OAuth 登入頁生物辨識按鈕改為帳密送出並導回 `biometric=1`

## 狀態 (Status)
已接受 (Accepted) — 2026-11-16（取代 ADR 0042 的決策 2「以 `error=passkey_requested` 導回 App 切換原生 Passkey」；ADR 0042 其餘決策不變）

## 背景與問題 (Context & Problem)
ADR 0042 讓 iOS 登入頁的「用 Face ID／Touch ID／Optic ID 登入」按鈕以 `error=passkey_requested` 導回 App，改走原生系統通行金鑰。實際使用後發現：
1. **多數使用者沒有建立通行金鑰**：iOS 沒有可用的通行金鑰時，系統會改跳「掃描行動條碼」以使用其他裝置上的通行金鑰，與按鈕「用 Face ID 登入」的預期不符。
2. **iOS 端的需求改變**：iOS Client 改為在帳密登入成功後，以裝置生物辨識（Face ID 等）保護存在 Keychain 的 Refresh Token，之後解鎖 App 時用生物辨識取用。按鈕要表達的是「登入，並開啟生物辨識保護」，而不是「改用通行金鑰登入」。

## 決策 (Decision)
1. **按鈕改為帳密表單的第二個送出鈕**：`<button type="submit" name="biometric" value="1">`，與主「登入」鈕放在同一個表單內、位於其下方（中間保留「或」分隔線）。按鈕文字與圖示沿用 ADR 0042 與 PR #217（lucide `scan-face`、`fingerprint`、`scan-eye`）。按 Enter 送出時仍是第一個送出鈕「登入」。
2. **帳密正確時導回帶 `biometric=1`**：`POST /oauth/authorize` 在登入模式、`biometric=1` 且帳密驗證成功時，照常發授權碼並導回 `redirect_uri?code=...&state=...&biometric=1`。主「登入」鈕不帶 `biometric`。
3. **錯誤處理與主登入鈕相同**：帳密錯誤、頻率限制等一律重新顯示表單（保留 `biometry` 與 `font_scale`，按鈕與字級都還在），不導回。
4. **顯示條件不變**：仍只在 `mode === 'login'` 且 `biometry` 為合法值時顯示；`biometric` 只在登入模式生效，註冊模式送來的值忽略。
5. **送出時避免重複送出，但不同步停用按鈕**：同步停用被按下的送出鈕會讓它不進表單資料，因此改為以旗標阻擋重複送出，停用延後到下一個 task。
6. **移除 `error=passkey_requested`**：授權伺服器不再產生此錯誤碼。`POST /oauth/passkey/authorize` 不受影響，Web 端的通行金鑰登入照舊。

## 後果 (Consequences)
- **正面**：按鈕行為與文字一致；沒有通行金鑰的使用者不會被導到「掃描行動條碼」；不需額外 round-trip 關閉再重開登入視窗。
- **負面**：`biometric=1` 只是 App 端的偏好提示，伺服器不驗證、也不改變權杖的權限或效期；Client 不能把它當作安全判斷依據。
- **相容性**：這項變更與 PR #217 同時發佈，`passkey_requested` 尚未被已發佈的 iOS App 依賴。不認得 `biometric` 參數的 Client 會照一般授權碼流程處理，不受影響。
- **難以反轉**：`biometric=1` 成為授權伺服器與 iOS App 之間的公開契約，上線後不可隨意更名或改變語意。
