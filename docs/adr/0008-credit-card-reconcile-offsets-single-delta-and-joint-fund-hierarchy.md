# 0008. 信用卡校準未出帳沖抵額、同卡單一淨差額運算、全站疊字清洗與家庭帳戶歸屬層級 (Credit Card Reconcile Offsets, Same-Card Single Net Delta, Phrasing Cleanup, and Joint Account Ownership Hierarchy)

## Context
在對照 iOS 版客戶端驗證 `f32ff6c` 實作時，發現以下 4 項核心會計與領域模型問題（GitHub Issue #27）：
1. **校準誤扣全額還款導致未出帳被算少**：`POST /accounts/:id/reconcile` 扣除了當期所有信用卡還款流水總額。但 `pay-credit-card` 優先沖銷已出帳待繳款（上期帳單），只有超額時才沖未出帳。若校準扣除全額，會將使用者結帳後刷的新消費誤扣甚至抹消歸零。
2. **同卡編輯交易狀態覆蓋 Bug**：`PUT /transactions/:id` 分別讀取帳戶餘額產生回沖與認列語句。當新舊帳戶為同一張信用卡時，後者基於未更新的舊餘額產生絕對值 `SET unbilled = ?, balance = ?`，覆蓋抹消了前者的回沖效果（例如刷退 300 改 200，回沖 +300 被後者覆蓋，欠款反減 200）。
3. **全域取代造成全站疊字與動詞語境失衡**：上次正名全域取代產生了「個人個人私帳」、「家庭群組群組」、「結帳日出帳出帳作業」等疊字，且將名詞「出帳作業」生硬當動詞使用（如「成功出帳作業為已出帳待繳款！」），同時還款備註將疊字寫入資料庫。
4. **家庭共同基金定義與畫面歸屬不一致**：`CONTEXT.md` 將家庭共同基金嚴格定義為銀行或現金正資產，但 Web 與 iOS 畫面的帳戶歸屬選項不分型別均標為家庭共同基金，導致新增信用卡時出現「信用卡歸屬為共同基金」之領域矛盾。

## Decision
1. **信用卡校準未出帳沖抵額 (`unbilled_offset`)**：
   - `transactions` 資料表擴充 `unbilled_offset REAL DEFAULT 0` 欄位。
   - 執行 `POST /accounts/:id/pay-credit-card` 時，計算還款金額在沖銷完 `card.balance` 後溢出沖抵 `card.unbilled` 的數額，記錄於信用卡端還款流水的 `unbilled_offset` 欄位中。
   - `reconcile` 計算時改為 `SELECT COALESCE(SUM(unbilled_offset), 0) FROM transactions WHERE account_id = ? AND category = '信用卡還款' ...`，精確僅扣減當期實際沖銷未出帳的金額。
2. **同卡編輯單一淨差額運算 (Single Net Delta)**：
   - 在 `PUT /transactions/:id` 中，若 `existing.account_id === account_id`，改為計算新舊交易對該帳戶的單一淨變更（Net Delta），只產生一條 `UPDATE accounts` 語句進入 D1 batch，徹底根除同表狀態競爭覆蓋。
3. **全站疊字精確清洗與動詞語法自然化**：
   - 清除後端回應訊息與前端組件中的所有疊字（還原為「個人私帳/個人帳戶」、「家庭群組/家庭帳本」、「結帳日出帳作業」、「信用卡待繳款」、「綁定中心」等）。
   - 動詞語境改為自然句式：「帳單出帳作業完成！已轉入已出帳待繳款。」
   - 修復還款寫入資料庫之 note，杜絕髒資料。
4. **家庭帳戶歸屬層級正名 (Joint Account Ownership Hierarchy)**：
   - 帳戶歸屬（`is_joint`）：劃分為「個人私帳 (`is_joint = 0`)」與「家庭公用 (`is_joint = 1`)」。
   - 家庭共同基金（`Joint Fund`）：歸屬於家庭公用之正資產帳戶（銀行與現金），專門用於家庭支出買單與報銷撥款。
   - 家庭信用卡（`Joint Credit Card`）：歸屬於家庭公用之信用卡負債帳戶。
   - Web UI 表單依帳戶類別動態呈現：銀行/現金顯示「個人私帳 / 家庭共同基金」，信用卡顯示「個人私帳 / 家庭信用卡」，帳戶檢視範圍標示為「家庭公用 (共同基金/家庭卡)」。

## Consequences
- 徹底解決結帳後繳上期卡費再校準導致本期新消費被誤扣歸零的嚴重會計缺陷。
- 徹底解決同一張信用卡上修改刷退或支出切換時餘額計算錯誤的覆蓋 Bug。
- 消除全站與後端 API 吐給客戶端的所有不自然疊字與生硬動詞。
- 領域模型層級與畫面表單嚴謹對齊，杜絕「信用卡是基金」的概念混淆。
