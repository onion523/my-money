# 0028. 信用卡未到結帳日提前出帳全量透視、上期與歷史延入款自動喚醒納入結算與校準一致性 (Pre-Statement Rollover Scope, Prior Deferred Items Auto-Awakening, and Reconciliation Consistency)

## Status
Accepted

## Context
在既有信用卡結帳日出帳機制（ADR-0020、ADR-0024）下：
1. **未到當期結帳日鎖死歷史區間 Bug**：
   後端推算結算區間之 `getStatementCycleDates` 僅依當日日期與結帳日比較（`currDay < statementDay` 則月份減一）。若持卡人在未到當期結帳日（例如 10/16，結帳日為 25 號）開啟出帳作業，系統強制回推為「8/26～9/25」，導致：
   - 上期結帳日後的當期累積消費（如 9/27 的消費）因大於 9/25 而被 SQL 日期過濾條件排除，完全無法在出帳彈窗中出現。
   - 上期標記延期的項目（如 9/20 的消費）因大於 8/25，被判定為非上期延入款（`isPriorDeferred = false`），維持預設勾選「延至下期」並劃線扣除。
   - 結果出帳彈窗顯示 0 筆待出帳、出帳淨額 NT$ 0，完全無法結算當前累積的未出帳負債。
2. **上期延入款無法自動喚醒**：
   在收支明細手動勾選「延至下期帳單」或前次出帳延期的項目，在後續執行出帳時應具備「延期一次、次期自動喚醒納入出帳」的商業語意。但受限於固定週期回推與 `isInitiallyDeferred` 判定邏輯，常態延期項目持續被預設勾選為延期，導致持卡人必須手動取消延期才能出帳。
3. **校準端點強制覆寫破壞未出帳狀態**：
   在 `reconcileCreditCardUnbilled` 中，歷史交易對齊 SQL 包含 `OR (date <= prevCutoffStatementDate)`，無差別將所有早於基準結帳日的歷史交易覆寫為 `is_billed = 1`，破壞了歷史延期款之 `defer_to_next_statement = 1, is_billed = 0` 未出帳屬性。

## Decision
1. **未到當期結帳日提前出帳支援全量未出帳透視**：
   - 當 `currDay < statementDay`（未到當期結帳日提前出帳／預覽）時：
     - 結算區間完整涵蓋自上期結算起始日（`prevStatementDate` 次日）起至今日（或當期結帳日）的所有未出帳消費與刷退，並一併納入上上期或更早遞延而來之歷史延入項目（`date <= prevStatementDate` 且 `defer_to_next_statement = 1 OR is_billed = 0`）。
     - 杜絕將結算週期鎖定在上個月歷史區間、排擠後續消費之問題。
   - **彈窗頂部橫幅動態標記**：
     - 若為未到結帳日之提前出帳，明確標示為涵蓋歷史延入的動態區間，例如 `8/26 ～ 今日（提前結算）`，並醒目標註 `含 X 筆歷史延入款（已預設納入結算）` 徽章。
     - 若為到達結帳日後之常態出帳，維持標示法定結算週期（如 `9/26 ～ 10/25`）。

2. **延期項目一律預設自動喚醒納入結算**：
   - 所有自歷史週期遞延而來之項目（包含在日常收支明細勾選「延至下期帳單」或前次出帳指定延期之款項，`defer_to_next_statement = 1` 或 `date <= prevStatementDate 且 is_billed = 0`）：
     - 在當期尚未執行出帳（首度開啟出帳預覽彈窗）時，**一律預設為「納入出帳」（`is_initially_deferred = false`）**。
     - 金額不劃線、不標記已延期，直接計入當期出帳淨額。
     - 持卡人若當期仍不擬出帳，仍可隨時於彈窗中手動點擊「延至下期」順延。
   - 若當期已確認出帳後二次檢視：維持呈現前次出帳所決定之延期狀態。

3. **維護未出帳自癒校準之延期狀態一致性**：
   - 修正 `reconcileCreditCardUnbilled` 中的狀態校準 SQL：
     - 凡標記 `defer_to_next_statement = 1` 之交易，嚴格維持 `is_billed = 0`，嚴禁因交易日期早於 `prevCutoffStatementDate` 而被強制覆寫為 `is_billed = 1`。

4. **出帳確認寫入與冪等全量重算**：
   - 點擊「確認出帳」（`POST /accounts/:id/rollover-statement`）時：
     - 被指定延期的項目更新為 `defer_to_next_statement = 1, is_billed = 0`。
     - 本次納入出帳的所有項目（含上期延入喚醒款與當期消費）更新為 `defer_to_next_statement = 0, is_billed = 1`。
     - 觸發底層真實明細冪等全量重算，更新卡片之 `balance` 與 `unbilled`，並記錄 `last_rollover_at = CURRENT_TIMESTAMP`。

## Consequences
- 徹底解決未到結帳日開啟出帳作業時「當期消費完全消失」與「上期延後項目未被計入」的嚴重 Bug。
- 達成符合直覺的「延後一次、次期自動喚醒納入結算」生命週期，使用者無須手動反選。
- 彈窗頂部明確標註動態區間（`上期起始日 ～ 今日（提前結算）`），對帳體驗透明清晰。
- 確保校準程序、未出帳金額與出帳作業預覽的會計數值 100% 冪等且一致。
