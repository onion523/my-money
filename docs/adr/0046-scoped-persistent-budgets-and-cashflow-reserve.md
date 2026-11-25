# 0046. 三態常駐預算體系、智慧每月總預算與可支配現金／預測預扣整合 (Scoped Persistent Budget System, Smart Monthly Total Budget, and Disposable Cash / Forecast Reserve Integration)

## Status
Accepted

## Context
系統原有的預算模組（`budgets` 資料表與 `/budgets` 端點）存在以下結構性限制：
1. **綁死單一月份且無法刪除**：`budgets` 資料表以 `UNIQUE(user_id, category, month)` 僅針對單一 `YYYY-MM` 儲存，每到新的一個月，所有分類預算全部歸零變回「未設定預算」，使用者被迫每個月重新逐一設定；且一旦設定後無刪除 API 與介面按鈕可清除預算。
2. **缺乏公私帳歸屬（Unscoped Budgets）**：全站（總覽、收支明細、帳戶、週期收支、統計分析、現金流預測）皆已落實「全部 (`all`) / 公帳 (`household`) / 私帳 (`personal`)」三態視角，唯獨 `budgets` 沒有 `is_shared` 欄位，且 `GET /budgets` 只撈取 `user_id = ?` 的所有支出（甚至未排除 `信用卡還款`、`內部轉帳` 等系統類別），導致家庭成員無法共享公帳預算，切換視角時預算進度亦不會隨視角連動。
3. **缺乏「每月總預算」把關視野**：僅有零散的 16 個單一分類預算，沒有「每月總預算」上限與總花費／剩餘可花費進度總覽卡，且總覽頁（`Dashboard.tsx`）僅在超支時才跳出警示，平時看不到本月預算使用率與剩餘額度。
4. **未與「真實可支配現金」及「現金流預測」串聯**：使用者設定了每月預算，但「真實可支配現金 (`Disposable Cash`)」僅扣除週期固定支出與儲蓄目標，未預留當月尚未花掉的預算額度；「現金流預測 (`Forecast`)」也無法模擬若每個月把預算花滿時的資金水位。

## Decision

經過訪談對齊（`grill-with-docs`），確立「**三態常駐預算體系 (Scoped Persistent Budget System)**」架構：

### 1. 資料模型擴充：公私帳兩層分離與常駐預設（`is_shared` & `month = 'default'`）
- `budgets` 資料表新增 `is_shared INTEGER NOT NULL DEFAULT 0` 欄位，唯一鍵升級為：
  - 個人私帳預算（`is_shared = 0`）：以 `(user_id, is_shared, category, month)` 唯一識別，僅本人可見與改刪。
  - 家庭公帳預算（`is_shared = 1`）：對同一家庭群組（`household`）成員共享共治，任一家庭成員皆可新增、調整與清除家庭公帳預算。
- **每月常駐預設 (`month = 'default'`) 與單月覆寫 (`month = 'YYYY-MM'`)**：
  - 前端設定預算時預設寫入 `month = 'default'`（每月常駐沿用），並相容指定特定 `YYYY-MM` 覆寫單月。
  - 當查詢某月份（`targetMonth`）之預算時，針對每個 `(is_shared, category)`，若存在 `month = targetMonth` 之紀錄則優先採用，否則自動回退採用 `month = 'default'` 之常駐設定。
- **支援刪除／清除預算**：提供 `DELETE /budgets`（或於 `PUT /budgets` 傳入 `amount = 0` / `DELETE /budgets/:id`），一鍵移除該分類或總預算設定。

### 2. 三態視角聚合與日常消費統計邊界
- **日常消費統計邊界**：計算預算之「已花費 (`spent`)」時，嚴格排除 4 項系統內部移轉類別（`'信用卡還款'`, `'內部轉帳'`, `'ATM提款'`, `'公帳代墊報銷'`），與統計分析之分類圓餅圖 100% 一致。
- **三態視角（`scope = all | household | personal`）規則**：
  - `household`（公帳）：僅載入家庭公帳預算（`is_shared = 1`）並對比家庭公帳日常支出。
  - `personal`（私帳）：僅載入本人私帳預算（`is_shared = 0`）並對比本人私帳日常支出。
  - `all`（全部）：將同一分類之「家庭公帳預算 ＋ 本人私帳預算」相加作為該分類於全部視角下的總預算額度，並對比「家庭公帳 ＋ 本人私帳」之日常支出總和。在新增／調整預算彈窗中，提供「私帳 / 公帳」二態歸屬切換按鈕供明確指定要設定哪一層預算。

### 3. 智慧每月總預算（Smart Monthly Total Budget：`category = '__TOTAL__'`）
- 支援以保留分類代號 `category = '__TOTAL__'` 設定「手動每月總預算（`manualTotalBudget`）」。
- 系統自動計算當前視角下之**每月有效總預算（`effectiveTotalBudget`）**：
  $$\text{effectiveTotalBudget} = \max\left(\text{manualTotalBudget},\ \sum_{c \in \text{Categories}} \text{budget}(c)\right)$$
- **當月剩餘未用預算（`remainingBudget`）**：
  $$\text{remainingBudget} = \max\left(0,\ \text{effectiveTotalBudget} - \text{totalMonthSpent}\right)$$

### 4. 真實可支配現金與現金流預測整合（防重複雙扣機制）
- **真實可支配現金 (`Disposable Cash`)**：
  - 由於當月已發生的消費（`totalMonthSpent`）已經實質扣減了現金／銀行存款餘額或增加了信用卡未出帳負債，為避免「已花掉的錢被扣一次、預算又再扣一次」的雙重扣款，系統僅預扣**當月剩餘未用預算（`remainingBudget`）**。
  - 公式更新為：
    $$\text{Disposable Cash} = \text{Available Balance} - \text{Monthly Recurring Expense} - \text{Monthly Savings Goals} - \text{Remaining Monthly Budget}$$
- **現金流預測 (`Forecast`) 「納入預算預扣」切換開關**：
  - 預測頁提供「納入預算預扣」開關（預設關閉，對應 API 參數 `include_budget = 1` / `0`）。
  - 當使用者開啟「納入預算預扣」時：
    1. **當月月底**（或若今日即當月最後一日則為今日）：若當月 `remainingBudget > 0`，排入一筆 `每月預算剩餘預留（YYYY-MM）` 支出事件（金額 `= remainingBudget`）。
    2. **未來 11 個月各月月底**：於預測區間內後續各月份的最後一日，依該月有效總預算（常駐預設或該月覆寫）排入一筆 `每月預算預留（YYYY-MM）` 支出事件，供使用者模擬每月預算花滿時的長期現金流與購買力試算（`POST /forecast/purchase-check` 亦同步支援 `include_budget`）。

## Consequences
- **優點**：
  1. 預算設定一次即可跨月常駐生效，大幅降低每月維護負擔，且隨時可清除或針對特定月份微調。
  2. 公私帳預算分離並在「全部」視角自動聚合，完美契合個人與家庭雙帳本核心架構。
  3. 透過僅預留「當月剩餘未用預算（`remainingBudget`）」，在「真實可支配現金」與「現金流預測」中徹底解決預算與實際消費重複雙扣的會計矛盾。
