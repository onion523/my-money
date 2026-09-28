# 0005. 交易修改刪除之帳戶餘額雙向連動與信用卡未出帳自動校準 (Transaction Balance Synchronization and Credit Card Reconciliation)

## Context
使用者回報在操作交易紀錄時發生帳務偏差：
有兩筆家庭公帳消費原本扣款帳戶選擇「玉山信用卡」，後續編輯改為「現金」，但在「帳戶管理」頁面中，這兩筆金額仍持續累積在該玉山信用卡的「個人私帳消費 (`personal_debt`)」中，且現金錢包亦未正確扣抵。

經根本原因分析（Root Cause Analysis）：
1. **交易更新與刪除未連動帳戶餘額**：
   - `backend/src/handlers/transactions.ts` 在 `POST /transactions` 時有維護帳戶的 `balance`（銀行/現金）或 `unbilled`（信用卡）。
   - 但在 `PUT /transactions/:id` 與 `DELETE /transactions/:id` 中，僅更新與刪除 `transactions` 資料表，完全缺少對 `accounts` 資料表餘額／未出帳金額的同步更新或回滾。
2. **信用卡公私帳債務分流失真**：
   - 當使用者將交易之 `account_id` 從信用卡改為現金後，信用卡的 `unbilled` 未被扣減。
   - `GET /accounts` 依據該信用卡關聯之近期支出交易動態分流公帳代墊 (`shared_debt`) 與個人消費 (`personal_debt`)。由於原公帳交易已改歸屬現金帳戶，信用卡關聯交易中已找不到該筆交易，導致殘留未出帳負債全數落入 `personal_debt`，造成私帳消費虛增。

## Decision
1. **交易修改與刪除實施全雙向餘額連動 (Bidirectional Rollback & Re-application)**：
   - **`PUT /transactions/:id` 餘額維護**：
     - 若變更帳戶 (`old_account_id !== new_account_id`)：
       - 舊帳戶全額回滾原交易影響（銀行/現金正資產帳戶支出回補 `balance += oldAmount`，收入扣回 `balance -= oldAmount`；信用卡負債帳戶支出扣減 `unbilled = MAX(0, unbilled - oldAmount)`）。
       - 新帳戶認列新交易影響（銀行/現金正資產帳戶支出扣抵 `balance -= newAmount`，收入增加 `balance += newAmount`；信用卡負債帳戶支出累計 `unbilled += newAmount`）。
     - 若帳戶未變更 (`old_account_id === new_account_id`)：
       - 正資產帳戶：依收支差額 `delta = (newDelta - oldDelta)` 補退餘額。
       - 信用卡帳戶：依支出差額 `diff = newAmount - oldAmount` 調整 `unbilled = MAX(0, unbilled + diff)`。
   - **`DELETE /transactions/:id` 餘額維護**：
     - 刪除交易時，原帳戶全額回滾該筆交易對餘額或未出帳的影響。
2. **新增信用卡「未出帳自動校準 (Reconcile)」功能**：
   - 後端新增 `POST /accounts/:id/reconcile` 端點，專門用於校準信用卡帳戶的 `unbilled` 金額。
   - 週期判定：根據該信用卡之 `statement_day`（結帳日），自動抓取最近一次結帳日之後的所有有效消費交易總和（若無設定結帳日則取全部未結轉交易總和），將 `unbilled` 自動校準為該總和，消除歷史落差。
   - 既有 `PUT /accounts/:id` 帳戶編輯彈窗同時保留對 `unbilled` 與 `balance` 的手動微調能力，達成自動對帳與彈性微調雙軌並行。
3. **前端帳戶管理介面整合**：
   - 在信用卡卡片上提供「🔄 校準未出帳」按鈕與操作回饋，使用者一鍵即可平帳並即刻復原公私帳刷卡分流統計。

## Consequences
- 徹底修復變更交易帳戶或金額後導致的信用卡未出帳虛增與私帳偏差問題。
- 刪除交易時自動返還資金或取消信用卡欠款，保持帳簿嚴格守恆。
- 提供一鍵自動校準工具，讓使用者隨時修復過去因版本缺漏造成的既有卡債落差。
