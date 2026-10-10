# 0023. API 讀寫分離、D1 批次聚合查詢與前端按需請求收斂 (API Read-Write Separation, D1 Query Batching, and Selective Frontend Refetching)

## Context
隨著家庭共同基金、多張信用卡未出帳自癒校準（`reconcileCreditCardUnbilled`）與公私帳分流功能疊加，使用者操作時感受到 API 回應與頁面切換速度明顯變慢。經診斷定位出四大效能瓶頸：
1. **讀取端點夾帶 N+1 迴圈與寫入鎖爭用（Write-Lock Contention）**：`GET /accounts` 與 `GET /accounts/balance` 在每次讀取時對每張信用卡執行 `reconcileCreditCardUnbilled`（每張卡觸發 6 次循序 D1 查詢，含 2 次 `UPDATE transactions` 與 1 次 `UPDATE accounts`）。當前端 `Promise.all` 同時呼叫這兩支 API 時，在 SQLite / Cloudflare D1 單寫入鎖架構下造成嚴重排隊阻塞。
2. **高頻基礎查詢往返過多（Sequential Round-Trips）**：`getUserHousehold` 在每個 API 開頭執行 3 次循序查詢；`GET /households/advances` 對每位成員執行 6～7 次查詢並在讀取時逐筆 `UPDATE` 歷史報銷標記。
3. **缺少複合索引與冷啟動並發遷移**：`transactions` 表缺乏 `(account_id, type, is_billed, date)` 等複合索引，且 `ensure*Schema` 僅以布林變數防護，遇到冷啟動並發請求時會重複觸發數十次 `ALTER TABLE`。
4. **前端切換視角與篩選時無差別全量重抓**：`Dashboard` 載入未使用的 `recurringApi.list()` 並在切換三態視角時重抓無關視角的 `budgets` 與 `goals`；`Transactions`、`Accounts`、`Analytics` 在變更篩選器或視角時重複拉取 `accountsApi.list()`、`householdApi.current()` 等不隨該篩選條件變動的靜態端點。

## Decision
1. **信用卡校準讀寫分離與批次唯讀聚合**：
   - 狀態自癒與寫入校準（`reconcileCreditCardUnbilled`）嚴格限縮於**寫入與帳務異動入口**（`POST/PUT/DELETE /transactions`、`POST /accounts/:id/reconcile`、`POST /accounts/:id/rollover-statement`、`POST /accounts/pay-credit-card`、`POST /bot/*`）。
   - `GET /accounts` 與 `GET /accounts/balance` 改為**純唯讀批次聚合**（零資料庫寫入），以 `account_id IN (...)` 搭配 `GROUP BY` 單次批次查詢計算所有信用卡之當期未出帳淨額與公私帳欠款分流（`shared_debt` / `personal_debt`）。
2. **後端查詢收斂、複合索引與單例初始化鎖（Single-Flight Promise Lock）**：
   - `getUserHousehold` 透過 `JOIN` 收斂為 **1 次 D1 查詢**一次取回家庭資訊、本人角色與全體成員清單。
   - `GET /households/advances` 移除逐成員迴圈查詢與讀取端 `UPDATE`，改以家庭全體成員批次查詢後於記憶體聚合。
   - 補齊 `transactions` 複合索引（`idx_transactions_account_type_billed_date`、`idx_transactions_shared_date`），並將 `ensureAccountsSchema`、`ensureRecurringSchema`、`ensureForecastSchema` 封裝於共用之 In-Flight Promise 單例鎖中，確保冷啟動並發請求僅執行一次 Schema 與索引初始化。
3. **前端二度篩選按需請求（Selective Inline Refetch）**：
   - 移除 `Dashboard` 未使用之 `recurringApi.list()`；將不隨三態視角（`scope`）或日期篩選變動之端點（如 `Transactions` 的 `accountsApi.list()` 與 `householdApi.current()`、`Dashboard` 的 `budgets` 與 `goals`、`Accounts` 的 `householdApi.current()`、`Analytics` 的跨視角同月統計）拆分為僅於初次掛載或資料異動後更新。

## Consequences
- 徹底消除 `GET` 讀取請求在 Cloudflare D1 上的寫入鎖爭用與逐卡 N+1 查詢，將首頁與帳戶頁讀取的資料庫往返次數降低 75% 以上。
- 切換「全部 / 公帳 / 私帳」與收支明細篩選時僅發送最小必要請求，達成毫秒級無閃爍切換體驗，同時完整保留信用卡帳務與代墊報銷的 100% 會計準確度。
