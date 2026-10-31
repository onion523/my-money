# 0033. 全系統 API 效能深度優化、預測事件投影與 HTTP 條件式快取架構 (Overall API Performance, Event Direct Projection, and HTTP Conditional Caching Architecture)

## Status
Accepted

## Context
隨著 My-Money 系統功能日益豐富（涵蓋個人與家庭雙帳本、信用卡出帳管理、60~365 天長程現金流預測、即時採購試算與即時統計報表），隨著記帳筆數與家庭成員操作頻率增長，整體後端 API 面臨以下多重運算與傳輸瓶頸：
1. **交易檢索與成對沖帳反向查詢的全表掃描開銷**：
   - `GET /transactions` 隨資料筆數擴增，單純依賴 `LIMIT / OFFSET` 導致資料庫需遍歷略過行；成對交易自癒與連動刪除（`findPairedTransaction`）在 `pair_tx_id` 欄位上缺乏專用索引，導致每次成對匹配皆觸發全表循序掃描（Full Table Scan）。
2. **現金流預測引擎的極高運算複雜度**：
   - `GET /forecast` 與 `POST /forecast/purchase-check` 採逐日 365 次外層迴圈檢查每一個週期項目，時間複雜度高達 $O(\text{days} \times N)$。在迴圈內部反覆執行 `new Date(year, month, 0).getDate()` 與字串格式化，產生龐大之 CPU 與記憶體垃圾回收負擔。
3. **統計報表端點字串 LIKE 阻礙索引範圍查找**：
   - `GET /transactions/summary/*` 端點（分類彙總、月度收支、家庭代墊分攤）普遍使用 `date LIKE 'YYYY-MM%'`，阻礙了 SQLite B-Tree 對日期欄位進行高效的範圍搜尋（Range Scan）。
4. **網路傳輸與前端跨頁籤切換之重複負載**：
   - 所有 GET 端點均缺乏 HTTP ETag 或條件式快取機制。當使用者在 Dashboard、Transactions、Accounts 與 Forecast 間切換時，即使底層資料庫毫無變動，仍需全量下載並重新解析數十至數百 KB 的 JSON 回應，造成頻寬與渲染資源浪費。

## Decision
經由架構設計樹訪談，達成五大核心優化共識：

1. **資料庫索引全面覆蓋與成對反向檢索專用索引**：
   - 建立專用索引 `idx_tx_pair_id ON transactions(pair_tx_id)`，將成對交易反向搜尋與自癒配對由 $O(N)$ 降至 $O(1)$。
   - 補齊交易複合查詢覆蓋索引，並於分頁層支援 `(date, created_at, rowid)` 之游標導航（Keyset / Cursor Pagination），同時維持原生 `limit` / `offset` 協定以確保現有前端完全向下相容。
2. **現金流預測引擎：演算法轉向「定期項目事件直接投影」與信用卡計算記憶化**：
   - 全面改寫 `getDaysInForecast`：捨棄逐日 365 次掃描，改由定期項目角度出發，直接計算預測區間（0 ~ 365 天）內對應的發生日期。時間複雜度由 $O(\text{days} \times N)$ 驟降為 $O(N \times \text{cycles})$，消除 95% 以上之無效運算。
   - 對同一張信用卡之多週期結帳日與繳款日計算實施單次請求記憶化（Memoization），杜絕重複的日曆推算。
3. **報表統計端點重構為閉區間日期比對**：
   - 在 `summary/category`、`summary/monthly` 與 `summary/household-shares` 中，將 `date LIKE ?` 重構為 `date >= ? AND date <= ?`。
   - 建立統計複合覆蓋索引 `idx_tx_stats ON transactions(user_id, is_shared, type, date)`，完全發揮 SQLite 索引範圍掃描能力。
4. **後端輕量 ETag 與 HTTP 304 條件式快取**：
   - 引入輕量 ETag 生成機制，當請求攜帶 `If-None-Match` 且資料無變更時直接回傳 `304 Not Modified`（空 Response Body）。
   - 在 CORS 設定中加入 `Access-Control-Expose-Headers: ETag` 與 `Access-Control-Allow-Headers: If-None-Match`。
5. **前端 Client 記憶體快取複用**：
   - 前端 `client.ts` 內建透明記憶體快取，發送 GET 請求時自動夾帶已快取的 ETag；當收到 `304` 時即刻複用本地快取，在零陳舊風險下大幅降低傳輸頻寬與延遲。

## Consequences
- **大幅縮短回應時間**：預測引擎運算由數十毫秒縮減至個位數毫秒，高頻成對操作不再造成 Worker 瓶頸。
- **節省網路與解析成本**：前端多頁籤切換在無資料異動時近乎瞬時載入，資料庫讀取負擔顯著減輕。
- **零破壞性升級**：API 介面維持向下相容，既有功能與展示邏輯無縫銜接。
