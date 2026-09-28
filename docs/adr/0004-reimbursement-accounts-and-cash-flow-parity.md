# 0004. 報銷收款帳戶脫敏共享、現金流口徑對齊與移轉分類過濾 (Reimbursement Accounts and Cash Flow Parity)

## Context
針對 iOS 端對照 `bd0507b` 提出的 5 項跨平台缺陷與口徑不一致（GitHub Issue #9）：
1. 替其他成員撥款報銷時，前端下拉選單因隱私隔離無法取得其他成員的收款帳戶。
2. 現金流預測（/forecast）、購買力試算（/forecast/purchase-check）與機器人查餘額（bot.ts）未納入現金錢包 (cash) 餘額，與帳戶淨可用餘額公式不一致。
3. 轉帳、還款與報銷在未帶 `date` 時使用伺服器 UTC 日期，造成凌晨 00:00～07:59 記帳跳日偏差。
4. 固定收支頁面新增/編輯時，帳戶下拉選單將現金錢包誤標為「信用卡」。
5. 交易明細頁頂部統計卡片加總了「內部轉帳、信用卡還款、ATM提款、公帳代墊報銷」等內部資金移轉，導致左口袋轉右口袋時虛增總收支。

## Decision
1. **報銷收款帳戶脫敏共享**：
   - 後端在 `GET /households/advances` 中為每位成員附加 `receiving_accounts: Array<{ id, name, type }>`，限定為正資產帳戶（`type IN ('bank', 'cash')`），完全隱藏餘額與信用額度等敏感隱私資訊。
   - 前端 `Family.tsx` 點擊報銷時直接讀取該成員的 `receiving_accounts`，使家庭成員間能順利相互撥款。
2. **統一現金流與查帳口徑（納入現金錢包）**：
   - 全面貫徹淨可用餘額公式：`cashTotal + bankTotal - ccBilled - ccUnbilled`。
   - `forecast.ts`（預測起點、購買力試算）與 `bot.ts`（查帳）均將隨身現金計入可用餘額，機器人查帳訊息中額外標示隨身現金總額。
3. **全面校準後端未帶日期之預設值**：
   - 轉帳 (`POST /accounts/transfer`)、還款 (`POST /accounts/pay-credit-card`) 與報銷 (`POST /households/reimburse`) 之 `date` 預設值統一改為 `getTaipeiDateString()`。
4. **固定收支帳戶下拉類型標示修正**：
   - `Recurring.tsx` 下拉選單改為三元判斷，正確將 `cash` 標示為「💵 現金」。
5. **交易明細頁收支統計排除內部移轉**：
   - `Transactions.tsx` 在全部分類時，排除 4 大內部移轉分類（信用卡還款、內部轉帳、ATM提款、公帳代墊報銷），與後端統計 API 保持一致；僅在使用者主動於下拉選單篩選該系統分類時，才統計該分類之明細總和。

## Consequences
- 解決跨成員撥款報銷操作阻塞問題，同時嚴守個人私帳金額隱私。
- 現金錢包在預測、試算、查帳與總覽中的計算口徑達到 100% 一致。
- 根除所有未帶日期端點的凌晨跳日隱患。
- 消除交易明細頁面左口袋轉右口袋虛增收支的困擾。
