# 0002. 系統時區校準、儲蓄目標卡控與前端錯誤邊界機制 (System Timezones, Goal Limits, and Error Boundaries)

## Context
針對 iOS 端實作對照發現的 5 項缺陷（GitHub Issue #2）：
1. 伺服器在 Cloudflare 執行時基準時間為 UTC，導致台灣時間凌晨（00:00～07:59）現金流預測 (forecast) 與機器人記帳 (bot) 判定為前一天。
2. 編輯儲蓄目標調低目標金額時未卡控已存金額，可能導致 saved_amount > target_amount。
3. 測試模擬機器人對話 (POST /bot/test-simulate) 在 bot_bindings 表中插入假綁定資料，污染真實綁定清單。
4. 前端總覽、統計、固定收支頁面使用 .catch(() => []) 靜默吞掉 API 錯誤，在斷網或後端故障時誤導使用者為帳戶資產 $0。
5. 家庭成員加入時間直接取 SQLite UTC 字串 slice(0, 10)，導致晨間加入成員顯示為前一天。

## Decision
1. **後端統一 Asia/Taipei (UTC+8) 基準時區**：
   - 後端引入統一日期與時區工具函式，所有現金流預測（GET /forecast）、購買力試算與機器人文字記帳皆以 Asia/Taipei 當地日期為準，徹底根除凌晨跨日偏差。
2. **儲蓄目標金額嚴格卡控 (Clamping)**：
   - 當使用者編輯目標（PUT /goals/:id）並調低目標金額小於現有已存金額時，系統自動將已存金額截斷為新目標金額（saved_amount = new_target_amount），維護 saved_amount <= target_amount 鐵律。
3. **模擬對話無副作用隔離**：
   - 移除在 bot_bindings 插入「模擬測試助手」的行為。/bot/test-simulate 直接以認證通過之 userId 執行對話解析與虛擬回覆，保持 bot_bindings 清單 100% 真實與純淨。
4. **前端顯式錯誤提示與重試機制**：
   - 移除 .catch(() => []) 靜默吞錯邏輯。當頁面 API 失敗時，於頂部顯示 Alert 警示橫幅（包含清晰錯誤說明與「重新嘗試」按鈕），絕不誤導為 $0 或無資料。
5. **本地時區解析成員加入時間**：
   - 前端採用瀏覽器本地時區解析 SQLite UTC 時間戳記，依使用者所在時區格式化為正規本地日期顯示。

## Consequences
- 徹底消除台灣使用者於凌晨使用記帳、試算時產生的時區跳日體驗問題。
- 儲蓄目標與機器人綁定資料庫狀態保持絕對乾淨與邏輯一致。
- 提升前端容錯與使用者感知，在弱網或伺服器異常時能明確知曉並進行重試。
