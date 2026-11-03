# ADR 0035: 收支後端篩選與區間統計、修改時間追蹤、私卡扣款帳戶遮蔽、家庭擁有者繼承與預測預扣卡款透明化 (#184, #163, #156, #121, #98, #87)

## 狀態 (Status)
已接受 (Accepted) — 2026-11-02

## 背景與問題 (Context & Problem)
為支援 Web 與 iOS 雙端客戶端（`raychiutw/my-money.ios`）在分頁載入、資料隱私、帳號生命週期與預測公式上的一致性，需解決目前 6 筆 Open Issues：
1. **#184（分頁下的收支篩選與區間統計）**：客戶端改用 `limit=20` + `cursor` 分頁後，無法在本地對整月交易進行關鍵字搜尋、收支類型篩選及計算總收入／總支出／每日小計。
2. **#163（收支修改時間欄位 `updated_at`）**：收支明細目前僅有 `created_at`，缺少最後修改時間 `updated_at`。
3. **#156（他人私卡脫敏洩漏預設扣款帳戶 & 寫入未驗證）**：`GET /accounts` 在 `is_masked: true` 分支以展開運算子保留了 `payment_account_id` 與 `payment_account_name`，洩漏持卡人綁定的個人銀行帳戶；且 `POST`/`PUT /accounts` 缺少對 `payment_account_id` 的類型與權限校驗。
4. **#121（建立家庭者刪除帳號連帶刪除整個家庭）**：`households.created_by` 設為 `REFERENCES users(id) ON DELETE CASCADE`，原建立者執行 `DELETE /auth/account`（或先 `leave` 後刪帳）會導致整個多成員家庭群組被連帶刪除。
5. **#98（預測頁起始餘額算式與預扣卡款）**：`GET /forecast` 的 `startingBalance` 已預扣未來 30 天外（或未設繳款日）的信用卡待繳款，但 API 未單獨回傳該預扣金額，導致前端「現金 + 存款 = 起始餘額」算式在有預扣卡款時不成立。
6. **#87（iOS 與 Web 詞彙對照）**：紀錄 iOS 與 Web 介面用詞差異於領域文檔，保持 API wire 契約一致。

## 決策 (Decisions)

### 1. `GET /transactions` 篩選擴充與 `GET /transactions/summary/range`（#184）
- `GET /transactions` 新增可選查詢參數：
  - `type`：`'income'` 或 `'expense'`（`AND t.type = ?`）。
  - `q`：關鍵字（去除首尾空白後若非空，以不分大小寫 `LOWER(COALESCE(..., '')) LIKE ?` 比對 `t.note`、`t.category`、`a.name`、`u.name` 四個欄位）。
  - 與既有 `scope`、`from`、`to`、`account_id`、`category`、`cursor`、`limit` 完整組合。
- 新增 `GET /transactions/summary/range`：
  - 接收與 `GET /transactions` 相同的篩選條件（`scope`、`from`、`to`、`account_id`、`category`、`type`、`q`）。
  - 遵循 `a09e923` 全量加總規則（不排除信用卡還款、內部轉帳、ATM提款、公帳代墊報銷），回傳：
    - `total_income`: 區間內符合條件之收入總額
    - `total_expense`: 區間內符合條件之支出總額
    - `count`: 區間內符合條件之總筆數
    - `by_day`: 依日期由新到舊（`date DESC`）排列之每日 `{ date, income, expense }` 陣列。

### 2. 收支修改時間欄位 `updated_at`（#163）
- `transactions` 資料表新增 `updated_at TEXT DEFAULT NULL`（新建與舊資料皆為 `null`）。
- 於 `PUT /transactions/:id` 更新時寫入 `datetime('now')`（UTC `YYYY-MM-DD HH:MM:SS`，與 `created_at` 格式一致），並由 `GET /transactions`、`POST /transactions`、`PUT /transactions/:id` 一併回傳。

### 3. 他人私卡脫敏遮蔽與 `payment_account_id` 嚴格校驗（#156）
- `GET /accounts` 的 `is_masked: true` 分支明確覆寫 `payment_account_id: null`、`payment_account_name: null`。
- `POST /accounts` 與 `PUT /accounts/:id`：
  - 當帳戶最終 `type !== 'credit_card'` 時，強制將 `payment_account_id` 設為 `null`。
  - 當 `type === 'credit_card'` 且傳入非空 `payment_account_id` 時，查詢並驗證該扣款帳戶必須存在於家庭成員範圍內、`type === 'bank'`，且屬於當前使用者本人或家庭共同帳戶（`is_joint = 1`），否則回傳 `400 Bad Request`。

### 4. 家庭建立者刪帳與退群之自動擁有權移交（#121）
- 在 `DELETE /households/leave` 與 `DELETE /auth/account` 中，若使用者所屬家庭尚有其他成員：
  - 自動選取順位第一之其他成員（`ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, joined_at ASC LIMIT 1`），將其 `household_members.role` 設為 `'admin'`，並同步更新 `households.created_by` 與 `household_invitations.inviter_id` 為該繼承成員之 `user_id`。
  - 若家庭僅剩本人 1 位成員，則一併清除家庭群組。

### 5. `GET /forecast` 新增 `cardDeduction` 與前端算式閉合（#98）
- `GET /forecast` 回應新增 `cardDeduction: Math.round(immediateCardDeduct * 100) / 100`。
- Web 端 `Forecast.tsx` 於起始餘額算式氣泡中，當 `cardDeduction > 0` 時顯示 `現金 + 存款 - 預扣卡款 = 起始餘額`。
