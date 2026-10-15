# 0024. 信用卡結帳日出帳作業透明化預覽彈窗、週期全量檢視與冪等真實明細重算 (Statement Rollover Preview Modal, Full-Cycle Scope, and Idempotent Ground-Truth Recalculation)

## Status
Accepted

## Context
在既有信用卡結帳作業機制下（ADR-0020）：
1. **黑盒子操作無感出帳**：使用者在帳戶管理點擊「出帳作業」時，僅跳出瀏覽器原生 `window.confirm` 確認框，無法預覽本期結算的實際起訖日期、消費與刷退筆數、本期出帳淨額，以及出帳後餘額變化。
2. **缺乏即時檢視與延期彈性**：若結帳日前夕有特定消費尚未向發卡銀行請款，使用者無法在出帳當下直接勾選「延至下期」，必須事先跳轉至收支明細頁面逐筆查找編輯。
3. **公私帳分流不可見**：個人信用卡上常有家庭公帳代墊消費，出帳時無法即時獲知本期出帳總額中有多少金額可向家庭共同基金報銷。
4. **缺乏冪等性與重複出帳失真風險**：原出帳邏輯採純增量累加（`balance = balance + rolled`）並僅撈取 `is_billed = 0` 之未出帳項目。一旦執行過一次出帳後：
   - 預覽清單即變為空清單（因所有明細已被標為 `is_billed = 1`），導致使用者無法再次回頭核對該期帳單明細或調整延期項目。
   - 若使用者事後補記消費或重複觸發出帳，盲目累加容易導致 `balance` 數字重複疊加或脫鉤，無法達到財務軟體要求的「冪等性（Idempotence）」。
   - 前端限制 `unbilled > 0` 才顯示出帳按鈕，導致當期出帳後按鈕消失，無法再次檢視帳單。

## Decision
1. **提供週期全量出帳預覽 API (`GET /accounts/:id/rollover-preview`)**：
   - 後端依據卡片之 `statement_day` 推算本期結算區間（`prevStatementDate` 與 `statementDate`）。
   - **全量撈取該結帳週期內之所有消費與刷退（不限定 `is_billed = 0`）**：
     - 納入條件：`category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')`
     - 日期條件：`(date <= statementDate AND (defer_to_next_statement = 0 OR is_billed = 1)) OR (date <= prevStatementDate AND defer_to_next_statement = 1)`
     - 包含先前已出帳者及未出帳者，讓使用者隨時可看見當期完整帳單明細與目前各項目的延期狀態。
   - 回傳統計數據：
     - `statementDate`、`prevStatementDate`
     - `totalExpense`（本期消費總額）、`totalRefund`（刷退折抵）
     - `netRolledAmount = Math.max(0, totalExpense - totalRefund)`
     - `sharedDebt`（本期家庭公帳代墊額度）、`personalDebt`（本期個人私帳消費額度）
     - `projectedBalance`、`projectedUnbilled`
     - `transactions`（本期完整明細清單）

2. **前端打造「出帳作業預覽彈窗 (Statement Rollover Modal)」**：
   - 點擊信用卡之「出帳作業」時開啟專屬彈窗，取代原生 `window.confirm`。
   - **常態可用按鈕**：只要信用卡有設定結帳日或有交易紀錄，卡片上隨時提供「出帳作業」按鈕，不再受限於 `unbilled > 0`。
   - **週期橫幅**：標示卡片名稱與本期結算起訖日期（如 `2026/09/11 次日 ～ 2026/10/10`）。
   - **統計指標摘要格**：展示本期消費、刷退扣抵、出帳淨額、預計出帳後已出帳與剩餘未出帳。
   - **公私帳債務拆解條**：呈現本期「家庭代墊公帳」與「個人私帳消費」之金額佔比。
   - **可滾動明細清單與語意徽章**：
     - **上期延入款（Prior-Cycle Deferred）**：`date <= prevStatementDate` 且尚未出帳之款項，標記藍紫色 `[上期延入]` 徽章，首度結算時**預設自動喚醒為納入本期出帳**（不預設勾選延期），亦可手動再次遞延。
     - **當期遞延款（Current-Cycle Deferred）**：被使用者點擊「延至下期」之款項標記琥珀色 `[延至下期]` 徽章，金額劃刪除線並排除於當期出帳。
     - **二次檢視延期判定**：若該卡當期已執行過出帳作業，再次開啟彈窗時維持標記仍為 `is_billed = 0 且 defer_to_next_statement = 1` 之項目為已延期。

3. **前端動態暫存試算與一次性提交架構**：
   - 在彈窗中切換明細的「延至下期」時，前端即時於本地記憶體中暫存，動態重算摘要金額、公私帳拆解與預估餘額，不對伺服器發送寫入請求。
   - 使用者點擊「確認出帳」時，呼叫 `POST /accounts/:id/rollover-statement`，於請求體中攜帶本次決定延期的 `deferredTxIds: string[]`。
   - 若使用者中途取消或關閉彈窗，所有暫存變更自動捨棄，資料庫維持原貌。

4. **後端真實帳務明細冪等重算（Idempotent Ground-Truth Recalculation）**：
   - 在 `POST /accounts/:id/rollover-statement` 批次事務中：
     - 將 `deferredTxIds` 中的項目更新為 `defer_to_next_statement = 1, is_billed = 0`。
     - 將當期其餘非延期項目更新為 `defer_to_next_statement = 0, is_billed = 1`。
     - 同期還款流水（`date <= statementDate`）對齊為 `is_billed = 1`。
     - 更新 `last_rollover_at = CURRENT_TIMESTAMP`。
   - **餘額不採增量累加，全面改依底層真實交易明細精確重算**：
     - **已出帳待繳款 (`balance`)**：
       $$\text{balance} = \max\Big(0,\ \sum_{\substack{\text{is\_billed}=1 \\ \text{type}=\text{'expense'}}} \text{amount} - \sum_{\substack{\text{is\_billed}=1 \\ \text{type}=\text{'income'} \\ \text{category} \ne \text{'信用卡還款'}}} \text{amount} - \sum_{\text{category}=\text{'信用卡還款'}} (\text{amount} - \text{unbilled\_offset})\Big)$$
     - **未出帳款 (`unbilled`)**：
       $$\text{unbilled} = \max\Big(0,\ \sum_{\substack{\text{is\_billed}=0 \\ \text{type}=\text{'expense'}}} \text{amount} - \sum_{\substack{\text{is\_billed}=0 \\ \text{type}=\text{'income'} \\ \text{category} \ne \text{'信用卡還款'}}} \text{amount}\Big)$$
   - 此重算邏輯保證 100% 冪等性（Idempotent）：無論重複執行幾次出帳、後續補登消費再次出帳、或反覆調整延期項目，帳戶的 `balance` 與 `unbilled` 永遠與實際明細完全吻合，絕不發生重複加總或金額漂移。

## Consequences
- 消除出帳黑盒子，使用者在出帳前能 100% 精確核對帳單金額與包含明細。
- 出帳當下即可直接排除未請款消費並遞延至下期，大幅簡化操作流程。
- 支援出帳後隨時再次檢視該期帳單明細與重新調整延期，大幅提升對帳靈活性。
- 餘額採底層真實明細全量冪等重算，徹底消弭累加誤差與重複疊加 Bug。
- 即時掌握家庭公帳代墊出帳責任，便於持卡人無縫接軌至家庭協同進行報銷申請。
