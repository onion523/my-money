# 0048. 週期支出預留金子帳戶、主／預留金加總區分顯示與預留不足往後平攤追補 (Reserve Sub-Accounts, Combined Parent-Reserve Balance Display, and Shortfall Catch-up Amortization)

## Status
Accepted

## Context
在 ADR-0047 建立「一年內週期準備金池（Sinking Fund）」後，使用者進一步提出兩項關鍵實務需求：
1. **將預留金與主帳戶日常資金分開管理，但又能看到整戶加總**：
   - 使用者希望在帳戶卡片上能設定「預留帳戶（Reserve Account）」，甚至直接在某個主銀行帳戶底下建立「預留金子帳戶（Sub-account，如銀行小查罐／子口袋）」，讓日常花用的主帳戶金額與預留金帳戶金額分開獨立記帳。
   - 同時，在該銀行帳戶卡片上，總餘額要顯示「主帳戶＋預留金子帳戶」的**加總金額**（方便與實體網銀 App 總存款核對），並在卡片內清楚拆解區分為**「主帳戶金額」**與**「預留金帳戶金額」**。
   - 所有被設為預留帳戶／預留子帳戶的餘額加總，即為目前的**「預留金總數（Actual Reserve Pool）」**。
2. **當預留金金額不足時，自動往後平攤在下次繳款之前的剩餘月份中**：
   - 若過去幾個月少存了預留金（或預留金被挪用），導致目前預留金帳戶的實際總餘額低於截至上月底應該累積的準備金水位，如果接下來每個月仍只按原本的每月平均（$\text{amount} / \text{cycleMonths}$）存錢，到了繳款日當天錢一定不夠付。
   - 系統必須自動算出預留金缺口，並將缺口**往後平攤在各筆週期支出「下次繳款之前的剩餘月份（含本月）」中**，同時將預留金帳戶專款專用（從可自由花用的「真實可支配現金」中隔離），並讓本月的待預留金額自動採用「含不足額往後平攤」的金額。

## Decision

經過訪談對齊（`grill-with-docs`），確立以下四大設計決策：

### 1. 預留金子帳戶與預留帳戶標記（`is_reserve` & `parent_account_id`）
- 於 `accounts` 資料表擴充兩個欄位（冪等遷移）：
  - `is_reserve INTEGER NOT NULL DEFAULT 0`：標記該銀行存款帳戶是否為「週期支出預留帳戶（預留金帳戶）」。
  - `parent_account_id TEXT DEFAULT NULL`：若該帳戶為掛載於某主銀行帳戶下之「預留金子帳戶」，則指向主銀行帳戶之 `id`（`type = 'bank'`）。
- **操作體驗**：
  1. 在「帳戶管理（`/accounts`）」的每張主銀行帳戶卡片上，提供**「＋ 預留子帳戶」**快捷按鈕（一鍵開啟新增預留子帳戶彈窗，自動綁定 `parent_account_id` 並勾選 `is_reserve = 1`）。
  2. 在新增／編輯任何銀行存款帳戶時，亦可手動勾選「設為週期支出預留帳戶（`is_reserve = 1`）」及選填「所屬主銀行帳戶（`parent_account_id`）」。
  3. 預留金子帳戶本身也是一個真實的 `bank` 帳戶，支援透過「帳戶互轉」從主帳戶把錢撥入預留金子帳戶（或從預留金子帳戶轉回主帳戶／直接扣款）。

### 2. 主銀行卡片「加總總餘額」與「主帳戶金額 vs 預留金帳戶金額」雙軌顯示
- 當某個主銀行帳戶（`P`）底下掛載有一個或多個預留金子帳戶（`C_1, C_2, ...`）時：
  - **卡片主餘額數字**：顯示整戶**加總總餘額** $= \text{Balance}(P) + \sum \text{Balance}(C_k)$。
  - **卡片內拆解資訊框**：清楚區分顯示：
    - **主帳戶金額**：$\text{Balance}(P)$
    - **預留金帳戶金額**：$\sum \text{Balance}(C_k)$（並列出子帳戶名稱、餘額與快捷編輯／轉帳按鈕）
  - **避免資產總額重複計算**：在「銀行存款總額」與「淨可用資金（`available`）」中，每個主帳戶與子帳戶各自的真實 `balance` 只加總一次（即 $\text{Balance}(P) + \sum \text{Balance}(C_k)$），絕不重複加計。

### 3. 預留金不足時，按比例分配並往後平攤至下次繳款前的剩餘月份（Shortfall Catch-up Amortization）
針對當前視角（`all` / `household` / `personal`）下所有**本期尚未繳納（`!is_settled_current_cycle`）之跨月長週期支出項目 $i$（$M_i \in \{2, 3, 6, 12\}$）**：
1. **時間軸定義**：
   - 設該項目每期應繳總額為 $A_i$，原始每月平均攤提為 $m_i = A_i / M_i$。
   - 設自上次到期月之後、**截至本月底**已走過之攤提月數為 $k_i \in [1, M_i]$（由 `resolveLongCycleWindow` 算出之 `accumulatedMonths`；若本月即為到期扣款月，則 $k_i = M_i$）。
   - 則**截至上月底（不含本月）**已走過之月數為：
     $$p_i = k_i - 1 \in [0, M_i - 1]$$
   - **距離下次繳款日（含本月在內）尚餘之可存錢月數**為：
     $$r_i = M_i - p_i = M_i - k_i + 1 \in [1, M_i]$$
     （例如：年繳 $M_i = 12$，每年 8 月繳款；在 5 月時，自去年 9 月至今年 4 月底已過 $p_i = 8$ 個月，距離 8 月繳款還有 5、6、7、8 月共 $r_i = 4$ 個月；若到了 8 月繳款當月仍未繳，則 $p_i = 11, r_i = 1$ 個月）。
2. **前期理想應有準備金 vs 實際預留金總數**：
   - 單筆項目截至上月底理論上應已留存之準備金為：
     $$E_i^{\text{prior}} = p_i \times m_i$$
   - 全體未繳長週期項目截至上月底應有準備金總和為：
     $$E_{\text{total}}^{\text{prior}} = \sum_{i} E_i^{\text{prior}}$$
   - 截至本月底應達標之理想準備金總和為：
     $$E_{\text{total}}^{\text{curr}} = \sum_{i} (k_i \times m_i)$$
   - 當前視角下所有預留金帳戶（`is_reserve = 1`）之實際存款總額為：
     $$R_{\text{actual}} = \max\left(0, \sum_{a \in \text{ReserveAccounts}} \text{balance}_a\right)$$
3. **不足額（Shortfall）按比例分配與往後平攤**：
   - **前期預留金總缺口**：
     $$S_{\text{total}} = \max\left(0, E_{\text{total}}^{\text{prior}} - R_{\text{actual}}\right)$$
   - 對每一筆未繳長週期支出項目 $i$：
     - 若 $E_{\text{total}}^{\text{prior}} > 0$ 且 $S_{\text{total}} > 0$：
       該項目按應有準備金比例（$w_i = E_i^{\text{prior}} / E_{\text{total}}^{\text{prior}}$）分攤到之現有預留金為 $R_i = R_{\text{actual}} \times w_i$，分攤到之前期缺口為：
       $$S_i = E_i^{\text{prior}} - R_i = S_{\text{total}} \times w_i$$
       將此缺口 $S_i$ **往後平攤在下次繳款之前的剩餘 $r_i$ 個月中**：
       $$\text{catchupMonthlyAdd}_i = \frac{S_i}{r_i}$$
       $$\text{effectiveMonthlyShare}_i = m_i + \frac{S_i}{r_i} = \frac{p_i m_i + r_i m_i - R_i}{r_i} = \frac{A_i - R_i}{r_i}$$
     - 若 $S_{\text{total}} = 0$（即實際預留金已達或超過截至上月底應有水位 $R_{\text{actual}} \ge E_{\text{total}}^{\text{prior}}$）：
       前期缺口 $S_i = 0$，追補額 $\text{catchupMonthlyAdd}_i = 0$，本月維持原始每月平均 $\text{effectiveMonthlyShare}_i = m_i$。

### 4. 預留金帳戶專款專用與「真實可支配現金（`Disposable Cash`）」防雙扣連動
- **淨可用資金（`available`）**：維持全戶總淨資產（`cashTotal + bankTotal - cardDebtTotal`，其中 `bankTotal` 包含主帳戶與預留金子帳戶），並額外回傳 `mainBankTotal`（主帳戶存款總額）與 `reserveBankTotal`（預留金帳戶存款總額）。
- **真實可支配現金（`disposable`）**：
  1. **隔離預留金專款（`reserveBankTotal`）**：已經存進預留金帳戶的錢（$R_{\text{actual}}$）屬於專款專用給未來跨期帳單的準備金，從可自由動用的日常現金中隔離扣除。
  2. **扣除含不足額追補後之本月尚需預留週期支出（`remainingMonthlyFixed`）**：
     - 设本月所有未繳項目之有效應預留總額為 $\text{effectiveRemainingMonthlyFixed} = \sum_{\text{unsettled}} \text{effectiveMonthlyShare}_i$（包含短週期未繳額＋長週期含不足額往後平攤後之本月應提撥額）。
     - 公式：
       $$\text{disposable} = (\text{available} - \text{reserveBankTotal}) - \text{remainingMonthlyFixed} - \text{monthlyGoals} - \text{remainingBudget}$$
     - **恆等防雙扣特性**：當使用者在當月透過「帳戶互轉」將資金 $\Delta$ 從主帳戶轉入預留金子帳戶時，主帳戶餘額（`available - reserveBankTotal`）減少 $\Delta$，同時預留金帳戶餘額 $R_{\text{actual}}$ 增加 $\Delta$，避免將已鎖入預留金帳戶的長期準備金誤當成零用錢花掉，也清楚反映本月尚需從主帳戶預留多少錢！

## Consequences
- **優點**：
  1. 完美支援「母帳戶＋預留金子帳戶」管理模式，帳戶卡片既能對齊網銀顯示「加總總餘額」，又能清楚拆開「主帳戶金額」與「預留金帳戶金額」。
  2. 當預留金不足時，系統不再死板只顯示靜態的每月平均，而是自動算出「距離下次繳款前，接下來每個月實際要存多少錢（含追補平攤）」才能在繳款日湊滿全額。
  3. 預留金子帳戶專款專用，真實可支配現金精準反映主帳戶可自由花用的安全額度。
