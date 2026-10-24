# 0032. 現金流預測之逾期／已過扣款日未扣繳信用卡帳單即刻歸屬與排程防偏機制 (Overdue Credit Card Deduction & Cycle Schedule Alignment in Cash Flow Forecast)

## Status
Accepted

## Context
在既有 `backend/src/handlers/forecast.ts` 的現金流預測引擎（`getAvailableAndCardEvents`）中：
1. **已出帳待繳款 (`balance > 0`) 排程偏移問題**：
   原邏輯透過 `findFirstDueDate(card.payment_due_day)` 從今日（`D0`）往後搜尋下一個符合 `day === payment_due_day` 的日期。若信用卡實際上已過本期扣款日（例如每月 20 號扣款，今日為 25 號），但銀行因假日順延或使用者尚未記帳還款（`balance > 0`），系統會錯誤地將該筆已出帳待繳款順延至「下個月 20 號」才扣除。
   這導致兩個嚴重失真：
   - 未來近一個月內的預測餘額未扣除這筆隨時會被銀行扣走的逾期／延遲帳單，造成可用資金虛高。
   - 因為已出帳扣款日被誤推至下個月，防重疊機制又把當期「未出帳 (`unbilled`)」再往後多推遲一個月。
2. **已過結帳日但尚未執行手動「出帳作業」之未出帳排程跳月問題**：
   原 `findUnbilledDueDate` 只要判斷 `todayObj.day > clampedTodayStmtDay`（今日日期大於結帳日），即無條件將未出帳歸入「下個月結帳日」，忽略了使用者可能尚未點擊「出帳作業」（`last_rollover_at` 早於本月結帳日且 `rawBilled === 0`）。若該期結帳日（甚至扣款日）已過但尚未手動出帳，這筆應於本期扣繳的未出帳消費會被整整延後一個月。

## Decision
經設計樹訪談對齊，確立現金流預測中信用卡待繳款之到期判定與即刻扣除規範：

1. **已出帳待繳款 (`billed > 0`) 之應扣款日判定與逾期即刻扣除（歸入今日 D0）**：
   - 若信用卡設有 `statement_day` 與 `payment_due_day`：
     依據 `calculateCardCutoffDates(card.statement_day, card.last_rollover_at)` 取得最近一期已出帳結帳日（`cutoffStatementDate`），並透過 `calculateCreditCardDueDate` 推算該期帳單對應之「原訂扣款日 (`originalDueDate`)」。
   - 若信用卡僅設 `payment_due_day`（未設 `statement_day`）：
     若今日日期大於本月扣款日（`today.day > clampedTodayDueDay`），則本月之扣款日即為已過期之 `originalDueDate`；否則為本月扣款日。
   - **逾期歸入今日（D0）**：
     當 `originalDueDate < todayStr`（代表已過扣款日但尚未扣款沖銷）：
     - 事件發生日期（`date`）強制歸入**今日（預測起始日 `D0 = todayStr`）**立即扣除，確保自第 0 天起之預測餘額與最低水位真實反映該筆即時負債。
     - 事件名稱標示原訂扣款日：`繳卡費 · ${card.name}（已出帳 · 原訂 MM/DD 扣款）`。
     - `event_key` 維持綁定原訂扣款日：`card_due:${card.id}:${originalDueDate}`，確保跨日檢視時不會因日期推進而重置使用者已勾選之「已繳」豁免狀態。

2. **未出帳累計 (`unbilled > 0`) 之結帳週期判定與不連帶順延防線**：
   - 當已出帳款因過期而歸入今日（`D0`）時，其對應的是過去已結帳週期（`originalDueDate < todayStr`），因此當期「未出帳（`unbilled`）」維持排入下一個正常結帳週期之扣款日，**絕不連帶往後多順延一個月**。
   - **已過結帳日但尚未手動執行「出帳作業」之處理**：
     在推算 `unbilled` 所屬結帳日時，檢查本月結帳日是否已完成手動出帳（`hasRolledCurrentCycle`：`last_rollover_at >= thisMonthStmtDate`）或已有已出帳餘額（`rawBilled > 0`）：
     - 僅當「`todayObj.day > clampedTodayStmtDay` 且（`hasRolledCurrentCycle` 或 `rawBilled > 0`）」時，未出帳才歸屬至下個月結帳日。
     - 若今日已過本月結帳日，但尚未執行手動出帳作業且 `rawBilled === 0`，則未出帳優先對應「本月結帳日」之扣款日；若連該扣款日也已過期（`< todayStr`），同樣歸入今日（`D0`）立即扣除並標示 `（未出帳 · 原訂 MM/DD 扣款）`，`event_key` 綁定該原訂扣款日。

## Consequences
- 消除信用卡過了扣款日未扣帳時的「現金流虛高盲區」，第 0 天起即刻反映待扣負債。
- 修正因已出帳逾期或未按出帳作業導致當期未出帳被錯誤延後一個月的連鎖排程偏移。
- 透過綁定 `originalDueDate` 之穩定 `event_key`，跨日檢視時「已繳」勾選狀態依然穩固保持。
