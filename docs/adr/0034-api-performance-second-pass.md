# 0034. API 效能二次優化：信用卡指標聚合、已結清事件範圍化、游標分頁與預測引擎收斂 (API Performance Second Pass)

## Status
Accepted

## Context
ADR 0023 與 0033 之後，靜態審查仍發現下列瓶頸：
1. `computeCreditCardsReadOnlyMetrics` 無日期範圍地載入信用卡全部歷史交易，被 `GET /accounts`、`/accounts/balance`、`/forecast`、`/forecast/purchase-check` 與 reconcile 共用，成本隨歷史筆數線性成長。
2. `getSettledKeysSet` 對 `forecast_settled_events` 全表讀取，無 `WHERE`、無清理，且會讀到其他使用者的資料。
3. 全域 `etag()` 僅節省傳輸頻寬，後端仍執行完所有 D1 查詢；ADR 0033 對「直接回 304」的描述與實作不符。
4. `GET /transactions` 的排序鍵與既有索引不吻合，前端預設仍走 `OFFSET` 分頁。
5. `GET /forecast` 逐日迴圈內重複 `events.filter`，且多個互不依賴查詢為循序 `await`。
6. `budgets.ts` 仍使用 `date LIKE ?`。
7. `idx_tx_pair` 與 `idx_tx_pair_id` 重複。

## Decision
1. **信用卡指標**：先實測各端點耗時與資料筆數確認瓶頸；方向為 SQL 端 `GROUP BY` 聚合，僅載入未結清週期之交易，並維持會計結果 100% 一致。
2. **已結清事件**：讀取限定本人與家庭成員（`user_id IN (...)`）。過期紀錄的清除**延後到後續版本**，第一輪部署不刪除任何正式資料；日後清除時保留天數取保守值（例如 90 天），並先以 `wrangler d1 export` 備份。
3. **ETag、跨網域 304 CORS 標頭保留與全域錯誤防線**：
   - 保留全域 `etag()` 中介層（修正認知為「僅節省傳輸」；降 DB 負載由其他項目達成）。
   - 於 `etag({ retainedHeaders })` 保留 `access-control-allow-origin`、`access-control-expose-headers`、`access-control-allow-credentials`，根治跨網域 `304 Not Modified` 因遺失 CORS 標頭遭瀏覽器阻擋（`TypeError: Failed to fetch`）的問題。
   - 前端 `client.ts` 之 `fetch` 設定 `cache: 'no-store'` 由 `apiCache` 單一控管條件式請求，且若收到 `304` 但本地無快取時自動重發無條件請求。
   - 後端新增全域 `app.onError`，記錄結構化錯誤日誌並統一回傳 `{ success: false, error: '伺服器內部錯誤，請稍後再試' }`（HTTP 500，保留 CORS 標頭）。
4. **交易列表**：預設改用 keyset 游標分頁，保留 `offset` 相容；補索引 `(user_id, date DESC, created_at DESC, id DESC)`，以 EXPLAIN 驗證。
5. **預測引擎與其餘**：以 Map 按日期預先分組事件；互不依賴查詢改 `Promise.all`；budgets 改閉區間比對；刪除重複索引。
6. **範圍界線**：`households/advances`、`export`、`bot`、`recurring/amortize` 不在本次範圍，待實作後實測再觀察。

## Consequences
- 信用卡相關讀取成本不再隨歷史交易總數線性成長。
- 已結清事件讀取量有界，並修正跨使用者資料讀取。
- 實作須先本機驗證會計結果一致，且未經使用者確認不得部署。
