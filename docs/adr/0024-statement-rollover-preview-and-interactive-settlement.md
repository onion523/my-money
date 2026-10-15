# 0024. 信用卡結帳日出帳作業透明化預覽彈窗與動態延期結算 (Statement Rollover Preview Modal & Interactive Deferred Billing)

## Status
Accepted

## Context
在既有信用卡結帳作業機制下（ADR-0020）：
1. **黑盒子操作無感出帳**：使用者在帳戶管理點擊「出帳作業」時，僅跳出瀏覽器原生 `window.confirm` 確認框，無法預覽本期結算的實際起訖日期、消費與刷退筆數、本期出帳淨額，以及出帳後餘額變化。
2. **缺乏即時檢視與延期彈性**：若結帳日前夕有特定消費尚未向發卡銀行請款，使用者無法在出帳當下直接勾選「延至下期」，必須事先跳轉至收支明細頁面逐筆查找編輯。
3. **公私帳分流不可見**：個人信用卡上常有家庭公帳代墊消費，出帳時無法即時獲知本期出帳總額中有多少金額可向家庭共同基金報銷。

## Decision
1. **提供出帳作業預覽 API (`GET /accounts/:id/rollover-preview`)**：
   - 後端依據卡片之 `statement_day` 與 `last_rollover_at` 試算本期結算區間（`prevStatementDate` 與 `statementDate`）。
   - 撈取該週期內所有待出帳消費（`type = 'expense'`、`is_billed = 0`、`defer_to_next_statement = 0`）與待出帳刷退（`type = 'income'`、`is_billed = 0`），以及上期遞延至本期之項目。
   - 回傳統計數據：
     - `statementDate`、`prevStatementDate`
     - `totalExpense`（消費總額）、`totalRefund`（刷退折抵）
     - `netRolledAmount = Math.max(0, totalExpense - totalRefund)`
     - `sharedDebt`（本期家庭公帳代墊額度）、`personalDebt`（本期個人私帳消費額度）
     - `projectedBalance = card.balance + netRolledAmount`
     - `projectedUnbilled = Math.max(0, card.unbilled - netRolledAmount)`
     - `transactions`（待出帳交易明細清單，包含 id, date, type, category, amount, is_shared, note, defer_to_next_statement）

2. **前端打造「出帳作業預覽彈窗 (Statement Rollover Modal)」**：
   - 點擊信用卡之「出帳作業」時開啟專屬彈窗，取代原生 `window.confirm`。
   - **週期橫幅**：標示卡片名稱與本期結算起訖日期（如 `2026/09/11 ～ 2026/10/10`）。
   - **統計指標摘要格**：展示本期消費、刷退扣抵、出帳淨額、預計出帳後已出帳與剩餘未出帳。
   - **公私帳債務拆解條**：呈現本期「家庭代墊公帳」與「個人私帳消費」之金額佔比。
   - **可滾動明細清單**：列出本期所有參與交易，每筆項目附帶「延至下期」開關按鈕。

3. **前端動態暫存試算與一次性提交架構**：
   - 在彈窗中切換明細的「延至下期」時，前端即時於本地記憶體中暫存，動態重算摘要金額、公私帳拆解與預估餘額，不對伺服器發送寫入請求。
   - 使用者點擊「確認出帳」時，呼叫 `POST /accounts/:id/rollover-statement`，於請求體中攜帶 `deferredTxIds: string[]`。
   - 後端在單一 D1 Batch 事務中：
     - 將 `deferredTxIds` 標記為 `defer_to_next_statement = 1`。
     - 將其餘參與交易更新為 `is_billed = 1`。
     - 更新卡片之 `balance`、`unbilled` 與 `last_rollover_at = CURRENT_TIMESTAMP`。
   - 若使用者中途取消或關閉彈窗，所有暫存變更自動捨棄，資料庫維持原貌。

## Consequences
- 消除出帳黑盒子，使用者在出帳前能 100% 精確核對帳單金額與包含明細。
- 出帳當下即可直接排除未請款消費並遞延至下期，大幅簡化操作流程。
- 即時掌握家庭公帳代墊出帳責任，便於持卡人無縫接軌至家庭協同進行報銷申請。
