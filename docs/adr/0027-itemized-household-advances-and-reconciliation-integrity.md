# 0027. 家庭代墊款明細實報實銷、公帳退款抵減與核銷完整性保證 (Itemized Household Advances Lifecycle, Shared Refunds, and Reconciliation Integrity)

Date: 2026-10-16

## Status

Accepted

## Context

在家庭協同管理（`Family.tsx`）中，成員以個人帳戶、私卡或現金代墊之公帳支出（`is_shared = 1` 且 `is_joint = 0`）會進入待報銷清單，由家庭共同基金執行撥款核銷。

然而，使用者反饋「家庭協同裡面的代墊清單跟實際收支對不上，代墊清單中有遺漏的收支項目」，經系統性代碼與會計模型排查，發現下列關鍵缺陷：
1. **GET 讀取端點具破壞性寫入副作用（Auto-Heal 貪婪吞食未報銷明細）**：
   在 `GET /households/advances` 中，存在一項「歷史差額自動沖銷機制」：當歷史報銷總額大於已關聯明細總額（`totalReimbursed > linkedTotal`）時，系統會在每一次使用者開啟家庭協同頁面時，自動尋找最舊的未報銷代墊交易，將其標記為 `reimbursement_id = 'historical_reimbursement'` 並直接執行資料庫 UPDATE 寫入。這導致明明尚未被手動勾選報銷的合法代墊支出，被系統靜默吞食、自待報銷清單中隱形，且在收支明細中被誤貼上 `公帳 · 已撥款` 標籤。
2. **POST 報銷端點存在貪婪猜測 Fallback**：
   在 `POST /households/reimburse` 中，若未帶 `advance_ids`，後端會自動依時間順序貪婪匹配未核銷明細打上 `reimbursement_id`，缺乏精確明細審計保證。
3. **公帳退款與刷退完全遺漏**：
   `GET /households/advances` 僅查詢 `t.type = 'expense'`，完全忽略了成員以個人卡片或帳戶代收之公帳退款、刷退或折讓（`type = 'income', is_shared = 1`），導致代墊總額未扣減退款而虛高。
4. **前端公式氣泡提示數學邏輯矛盾**：
   待報銷總額公式提示宣告為 `累計公帳墊付 － 累計已獲撥款 ＝ 待報銷總額`，但後端回傳之待報銷金額實為未關聯明細之總和；當存在歷史非明細定額撥款或差額時，算式左右兩邊數字兜不攏，產生強烈認知矛盾。
5. **缺乏「已結清明細」透明度與「解除報銷」退回機制**：
   一旦交易被打上 `reimbursement_id`，即自代墊清單中徹底消失，使用者無法在家庭協同中查閱該筆消費究竟是由哪一次撥款沖銷，若遭誤核銷更完全無法手動撤回。

## Decision

我們決定徹底重構家庭代墊生命週期，落實「**明細實報實銷制（Itemized Reconciliation）**」與「**純唯讀查詢完整性（Read-Side Idempotency）**」：

### 1. 徹底廢除讀取查詢自動核銷副作用 (Eliminate Auto-Heal in GET Advances)
- 刪除 `GET /households/advances` 中所有 `totalReimbursed > linkedTotal` 的自動 `UPDATE transactions SET reimbursement_id = ...` 邏輯。
- 查詢端點落實 100% 冪等純讀取，絕不對資料庫產生任何變更副作用。
- 在 `POST /households/reimburse` 中移除無明細時的貪婪自動匹配邏輯，嚴格落實依前端明確勾選之 `advance_ids` 進行關聯結清。

### 2. 歷史誤吞標記自動平反重置 (Historical Auto-Heal Reset)
- 提供單次冪等遷移邏輯：在系統啟動或首次執行時，自動執行 `UPDATE transactions SET reimbursement_id = NULL WHERE reimbursement_id = 'historical_reimbursement'`。
- 將過去所有被歷史差額自癒機制誤吞的代墊收支全數重置為未報銷狀態，使消失的代墊明細立即重回待報銷清單供使用者檢視與勾選。

### 3. 明細實報實銷制與溢撥款獨立揭示 (Itemized Calculation & Surplus Prepayment)
- **待報銷總額定義**：嚴格等於「目前待報銷清單中所有未報銷項目之金額總和」（$$\sum \text{待報銷支出} - \sum \text{待報銷退款}$$）。
- **公式透明化重構**：Tooltip 清楚說明「待報銷總額 = 待報銷清單項目加總」。
- **溢撥款／預收款獨立提示**：若累計撥款總額大於已勾稽明細總額（`total_reimbursed > total_linked`），介面獨立標示「家庭基金溢撥／預收款：NT$ X」，絕不自動侵吞後續新增的代墊明細。

### 4. 支援個人帳戶公帳退款／刷退負項抵減 (Shared Refunds Offset)
- `GET /households/advances` 納入個人帳戶（`is_joint = 0`）之公帳收入（`type = 'income'`, `is_shared = 1`，排除內部轉帳、信用卡還款、公帳代墊報銷等系統類別）。
- 代墊清單中將公帳退款以綠色負項顯示，並於計算待報銷總額時作為減項抵扣，確保代墊金額真實精確。

### 5. 已結清明細分頁與解除報銷退回機制 (Settled Advances Tab & Unlink Action)
- **分頁檢視**：在家庭協同展開區塊中，新增「待報銷明細」與「已結清明細」分頁標籤，讓成員隨時稽核已報銷項目的結清關聯（關聯至哪筆撥款流水）。
- **解除報銷操作**：新增 `POST /households/advances/:id/unlink` API，允許家庭管理員或該筆收支記錄者將已結清明細「解除報銷（退回待報銷）」，將其 `reimbursement_id` 重置為 `NULL`，恢復為待報銷狀態。

## Consequences

### Positive
- **徹底根除代墊消失幽靈現象**：代墊明細不再無故從清單中蒸發，每一筆待報銷項目都擁有明確的使用者授權結清路徑。
- **收支與退款完整平衡**：退貨與刷退正確抵扣代墊款，解決了公帳退款無法核銷的盲區。
- **可逆性與審計透明度**：成員與管理員可隨時查驗已核銷清單，若發生誤勾或操作失誤亦可一鍵退回。
- **純讀取安全保證**：GET 端點不再執行資料庫寫入，大幅提升系統穩定度與查詢並行表現。

### Negative / Trade-offs
- 原先被自動沖銷之歷史交易在平反重置後會重新出現在待報銷清單中，若家庭過去已有私下口頭結清但未關聯明細之舊帳，使用者需手動一次性勾選並執行報銷，或使用「已結清明細」進行確認。
