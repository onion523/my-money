# 0047. 週期收支雙軌已繳扣除、防雙扣可支配現金與一年內週期準備金池 (Recurring Dual-Track Settlement Deduction, Anti-Double-Deduct Disposable Cash, and 1-Year Sinking Fund Reserve)

## Status
Accepted

## Context
系統原有的「週期支出每月平均（`monthlyFixed`）」與「真實可支配現金（`Disposable Cash`）」存在以下會計與使用者體驗缺口：
1. **當月已繳納之週期帳單遭重複雙扣**：
   `GET /accounts/balance` 在計算 `disposable` 時，無條件減去靜態的 `monthlyFixed = ∑ (amount / cycleMonths)`。當使用者在當月已經實際支付了房租或定期帳單時，銀行存款餘額已經減少（或信用卡未出帳已經增加），但 `monthlyFixed` 依然全額再扣一次，導致「真實可支配現金」被重複雙扣而失真。
2. **缺乏「已繳扣除」與「一年內週期準備金池（Sinking Fund）」視野**：
   使用者無法在「週期收支（`/recurring`）」或「總覽頁（`/`）」直觀看到：
   - 這個月有哪些週期項目已經真正發生／已繳？扣除已繳後，本月還需要預留多少金額？
   - 為了應付未來一年內必將到期的長週期大額帳單（如年繳保費、牌照稅、季繳、半年繳），這筆「專款準備金（Sinking Fund）」與一般「夢想儲蓄目標（Savings Goal）」有何區別？截至本月，銀行帳戶內應該要已經累積留存多少一年內週期準備金？

## Decision

經過訪談對齊（`grill-with-docs`），確立「**獨立週期準備金池（Recurring Sinking Fund Reserve）＋雙軌自動聯動已繳判定＋精準待預留額扣減**」架構：

### 1. 會計定位：獨立為「週期準備金池（Sinking Fund）」，不混入一般夢想儲蓄目標
- 為未來一年內必付之長週期帳單（年繳、半年繳、季繳、雙月繳）按月攤提留存的資金，定義為**「一年內週期準備金池（Recurring Sinking Fund Reserve）」**。
- 該準備金屬於「未來一年內確定到期之必付負債預留」，非自由財富累積，因此**不混入「儲蓄目標（`/goals`）」頁面的夢想儲蓄總額與達成率**，而是獨立於「週期收支（`/recurring`）」與「總覽頁（`/`）」清晰揭示。

### 2. 雙軌自動聯動「已發生／已繳」判定（Dual-Track Settled Detection）
系統針對每筆週期收支項目，透過雙軌機制自動判定當期是否已發生／已繳：
1. **軌道一（實際收支明細 `transactions` 自動比對）**：
   - 檢索該項目當前週期區間內，是否存在同收支類型（`type`）、同公私帳歸屬（`is_shared`），且備註（`TRIM(LOWER(note))`）包含或等於該週期項目名稱（`TRIM(LOWER(name))`）之實際收支紀錄。
   - 若存在匹配之收支紀錄，自動標記為已發生／已繳（`is_settled_this_month = true`, `settled_source = 'transaction'`；針對 `weekly` 每週項目，計算當月實際匹配之金額或次數，上限為當月應付總額 `amount * 4`）。
2. **軌道二（手動勾選「已繳」雙向互通 `forecast_settled_events`）**：
   - 與現金流預測之 `forecast_settled_events` 資料表互通。若當月該項目對應之排程事件已被勾選為已繳（或於週期收支頁面直接點擊「標記本月已繳」寫入 `recurring:{id}:{YYYY-MM}` / 當月排程 `event_key`），即認定為已繳（`is_settled_this_month = true`, `settled_source = 'manual'`）。
   - 使用者在「週期收支」頁面的每張卡片上皆可一鍵切換「本月已繳 / 標記已繳」，並與「現金流預測」頁面雙向同步。

### 3. 精準當月待預留額（`remainingMonthlyFixed`）與一年內準備金計算
針對每一筆週期支出項目 $i$（週期月數 $M_i \in \{0.25, 1, 2, 3, 6, 12\}$，每期金額 $A_i$，每月平均攤提 $m_i = A_i / M_i$）：
1. **當月已繳扣除後之尚需預留金額（`remainingMonthlyFixed`）**：
   - **短週期（`weekly`, `monthly`）**：
     - `monthly`：若本月已繳，本月待預留 $= 0$（已繳金額 $= A_i$）；若本月未繳，本月待預留 $= A_i$。
     - `weekly`：當月應付 $= 4 A_i$；若本月已被手動標記整月已繳則待預留 $= 0$，否則扣除當月已發生匹配之收支金額（或已勾選已繳之週次金額），待預留 $= \max(0, 4 A_i - \text{settledAmount}_i)$。
   - **長週期（`bimonthly`, `quarterly`, `semiannual`, `annual`，即 $M_i \ge 2$）**：
     - 若該項目於当前週期（含本月到期或提前繳納）**已繳清**：本月待預留 $= 0$。
     - 若該項目於**本月剛好為到期扣款月（`isDueThisMonth`）且尚未繳**：本月待預留為其當月應扣之每月攤提（或於週期看板同時揭示本月到期應付全額與帳上累計應備妥之準備金）。為使每月平均攤提恆等式一致：每筆未繳項目對「當月週期每月平均待預留（`remainingMonthlyFixed`）」之貢獻為其尚未繳納之當月攤提份額 $m_i$（若已繳則扣除 $m_i$ 為 $0$），使得：
       $$\text{remainingMonthlyFixed} = \sum_{i} \text{remainingMonthlyShare}_i = \text{monthlyFixed} - \text{settledMonthlyFixed}$$
2. **一年內週期準備金池與年度待付指標（1-Year Sinking Fund Metrics）**：
   - **一年內週期支出年度總額（`annualTotalExpense`）**：$\sum_i (m_i \times 12)$。
   - **本週期／今年已繳納總額（`annualSettledExpense`）**與**一年內尚待支付總額（`annualRemainingExpense`）**：統計今年（或各項目當前週期）已實際繳納之金額與未來一年內尚待支付之剩餘總額。
   - **長週期帳戶應留存準備金水位（`accumulatedSinkingFund`）**：
     針對所有長週期支出（$M_i \ge 2$），若當前週期尚未繳納，依據自上次應繳月之後至本月已累積之攤提月數 $k_i \in [1, M_i]$，計算截至本月帳戶內應已專款留存之準備金：
     $$\text{accumulatedSinkingFund} = \sum_{M_i \ge 2,\ \text{unsettled}} k_i \times m_i$$

### 4. 真實可支配現金（`Disposable Cash`）更新
- `GET /accounts/balance` 回傳：
  - `monthlyFixed`（原始週期支出每月平均總額）
  - `settledMonthlyFixed`（本月已發生／已繳之週期支出每月平均份額）
  - `remainingMonthlyFixed`（`= max(0, monthlyFixed - settledMonthlyFixed)`，扣除已繳後本月尚需預留之週期支出）
  - `accumulatedSinkingFund`（截至本月長週期項目帳戶應留存之一年內準備金水位）
  - `annualFixedTotal` / `annualFixedRemaining`（一年內週期支出總額與尚待支付總額）
- **真實可支配現金公式**：
  $$\text{disposable} = \text{available} - \text{remainingMonthlyFixed} - \text{monthlyGoals} - \text{remainingBudget}$$

## Consequences
- **優點**：
  1. 徹底消除「當月已付房租／固定帳單後，真實可支配現金又被重複扣一次」的痛點。
  2. 清楚區分「必付帳單的一年內週期準備金池（Sinking Fund）」與「自由財富累積的儲蓄目標（Goals）」，並在週期收支頁與總覽頁一目了然呈現「每月平均 vs 本月已繳 vs 本月待預留」以及「一年內應留存準備金水位」。
  3. 雙軌自動比對收支明細備註，並支援在週期收支卡片上一鍵勾選／取消「本期已繳」。
