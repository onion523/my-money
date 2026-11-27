# My-Money (個人與家庭雙帳本)

一套專為個人與伴侶／家庭設計的全方位現代記帳系統，涵蓋即時現金流、資產負債平衡、信用卡出帳管理、內部轉帳、家庭共同基金管理、週期收支平攤預測，以及 LINE / Telegram 對話式智慧記帳。

## Language

### 核心帳簿與總覽 (Core Ledger & Accounts)

**Transaction (收支明細 / 收支紀錄)**:
帳簿中記載特定日期與時間的資金流入、流出或審計轉帳紀錄。全站介面、彈窗標題、表單欄位、確認提示與後端錯誤訊息之原「交易」、「交易記錄」、「交易明細」、「交易日期」全面收斂正名為「收支」、「收支明細」、「收支紀錄」、「收支日期」，嚴禁殘留任何「交易」字眼。
_Avoid_: 交易 (transaction)、交易記錄 (transaction records)、交易日期 (transaction date)、新增交易記錄 (add transaction)、編輯交易記錄 (edit transaction)、記帳紀錄 (entry)、流水帳 (log)

**Automatic Taipei Time Recording & Newest-First Sorting (收支時間自動記錄與最新時間優先排序)**:
所有收支紀錄（涵蓋收支明細頁新增、儀表板快速記帳、帳戶管理之 ATM 提款／轉帳與信用卡還款、家庭協同代墊報銷，以及 LINE / Telegram 機器人記帳）在建立時，表單維持僅讓使用者選取「收支日期 (`YYYY-MM-DD`)」，系統於背景自動擷取建立當下之台灣時區時間（`Asia/Taipei` UTC+8 之 `HH:mm` 時分，不可手動修改；編輯收支時保留原建立時間）。既有歷史資料若未帶時分，自動由資料庫 `created_at` 轉換為台灣時間（UTC+8）補齊 `HH:mm`。
- **各頁面時間顯示格式**：
  1. **收支明細頁 (`Transactions`)**：維持「按日分組卡片 (`MM/DD`)」，單筆明細列第二行顯示 `HH:mm · 帳戶：名稱`。
  2. **儀表板最近收支明細 (`Dashboard`)**：單筆明細列第二行顯示 `MM/DD HH:mm · 帳戶：名稱`。
  3. **家庭代墊與報銷明細 (`Family`) 及 CSV 匯出 (`Export`)**：完整顯示 `YYYY-MM-DD HH:mm`。
- **預設排序準則**：全站收支清單預設先依「收支日期 (`date DESC`)」由新到舊分組，同日內依「實際記錄時間 (`created_at DESC` / `HH:mm` DESC)」由最新排在最上方。
_Avoid_: 僅記錄日期無時間 (date-only without time)、手動修改時分選擇器 (manual time picker in form)、同日收支順序混亂或舊帳在上方 (oldest-first or arbitrary same-day ordering)

**Recent Transactions (最近收支明細)**:
總覽頁顯示最近 6 筆收支明細的區塊（原「最近交易記錄」），單筆格式與收支明細頁共用同一元件：第一行「分類 · 備註」與公私帳、已出帳／延至下期徽章，第二行「MM/DD HH:mm · 帳戶：名稱」與記帳人徽章；不含編輯／刪除。所有收支明細列表遇長備註或多徽章一律自動換行完整顯示，不得截斷為單行省略。
_Avoid_: 最近交易記錄 (recent transaction records)、單行省略 (single-line ellipsis)

**Infinite Scroll Pagination of Transactions (收支明細無限捲動分頁載入)**:
「收支明細」(`Transactions`) 頁不得再以單次 `limit=200` 截斷資料，必須能瀏覽帳簿內「所有」符合條件的收支明細。採 cursor 分頁（`next_cursor`），每頁 50 筆，由 `IntersectionObserver` 哨兵元素提前觸發自動載入；載入中於清單底部顯示骨架，全部載完顯示「已顯示全部 N 筆」。
- **篩選下推後端**：類型、分類、帳戶、關鍵字、日期區間一律以查詢參數交由後端篩選（`type` / `category` / `account_id` / `q` / `from` / `to`），前端不再對已載入資料做本地篩選；條件變更即重置回第一頁。
- **合計以後端彙總為準**：頂部收入／支出合計與符合筆數，取自後端 `GET /transactions/summary/range`（與清單相同篩選條件），不受已載入頁數影響。
- **異動後就地重載**：新增／編輯／刪除後，就地重新載入「目前已載入的範圍」並保留捲動位置，不跳回頂部；僅篩選條件變更才重置。
- **歷史備忘維持現狀**：新增表單的歷史備忘推薦 (`buildHistoryMemo`) 仍僅以已載入資料建立。
_Avoid_: 單次 200 筆上限 (hard 200-row cap)、前端本地篩選 (client-side filtering of partial data)、僅合計已載入筆數 (totals over loaded rows only)、載入更多按鈕 (load-more button)

**Transaction Balance Synchronization (收支餘額雙向連動)**:
在建立、編輯 (PUT) 或刪除 (DELETE) 收支時，系統必須嚴格維持收支金額與所屬資產帳戶餘額／信用卡未出帳金額的雙向即時同步。若編輯收支時變更所屬帳戶，舊帳戶必須全額回滾原收支金額，新帳戶則扣抵／認列新收支金額；若僅變更金額，則按差額補退；刪除收支時則全額回滾該帳戶之餘額或未出帳負債。
_Avoid_: 單向更新 (unilateral update)、非連動記帳 (detached logging)

**Account (資產帳戶)**:
存放資金之個別實體或數位載體，例如現金皮夾、活存銀行帳戶、信用卡帳戶。
_Avoid_: 錢包 (wallet)、卡片 (card)、總帳 (ledger)

**Cash Wallet (現金錢包)**:
成員存放實體現鈔之正資產帳戶，預設歸屬於個人私帳管理，用於菜市場、小吃攤等實體日常零錢支付。
_Avoid_: 零錢包 (coin pouch)、皮夾 (wallet)、現金帳 (cash ledger)

**Bank Account (銀行存款帳戶)**:
個人或共同持有的活期存款正資產帳戶。支援於主銀行帳戶下建立獨立之「預留金子帳戶（`parent_account_id` 指向主銀行帳戶且 `is_reserve = 1`）」或將任一銀行帳戶標記為「週期預留帳戶（`is_reserve = 1`）」。
_Avoid_: 現金帳戶 (cash account)、活存帳戶 (deposit account)

**Reserve Sub-Account & Combined Bank Balance Display (預留金子帳戶與主／預留金加總區分顯示，ADR-0048)**:
在銀行存款帳戶（`type = 'bank'`）架構下，支援將預留金與主帳戶日常資金獨立分開記帳，同時於主帳戶卡片呈現加總與拆解：
1. **建立預留金子帳戶或標記預留帳戶**：
   - 使用者可於任一主銀行帳戶卡片直接點擊「＋ 預留子帳戶」建立掛載於該主帳戶下之預留金子帳戶（`parent_account_id = 主帳戶 ID`, `is_reserve = 1`），亦可於新增／編輯銀行帳戶時勾選「設為週期支出預留帳戶（`is_reserve = 1`）」並選擇所屬主銀行帳戶（選填）。
   - 主帳戶與預留金子帳戶各自擁有獨立餘額，日常可透過「帳戶互轉」將資金從主帳戶撥入預留金子帳戶（或於繳費時從預留金子帳戶扣款／轉回）。
2. **主銀行卡片「帳戶總餘額（加總）」與「主帳戶金額 vs 預留金帳戶金額」雙軌揭示**：
   - 當主銀行帳戶下掛載有一個或多個預留金子帳戶時，主銀行帳戶卡片主數字顯示**「整戶加總總餘額（`= 主帳戶金額 + 預留金子帳戶金額`）」**（與實體網銀 App 整戶總存款一致），並於卡片內清楚拆解並列：
     - **主帳戶金額**：`$主帳戶餘額`
     - **預留金帳戶金額**：`$預留金子帳戶餘額加總`（並提供快捷轉帳／編輯子帳戶入口）
3. **預留金總數（Reserve Pool Total）**：
   - 當前視角（全部／公帳／私帳）下所有標記為 `is_reserve = 1` 之預留金帳戶（含預留金子帳戶與獨立預留銀行帳戶）餘額加總，即為目前實際已留存之**「預留金總數（`actual_reserve_balance`）」**。
_Avoid_: 主帳戶與預留金混在同一個數字看不出各自多少 (mixing main and reserve balances without breakdown)、建了子帳戶卻在母帳戶看不到整戶加總金額導致與網銀總額對不上 (failing to show combined total on parent bank card)

**Credit Card (信用卡帳戶)**:
發卡機構授予循環信用額度之負債帳戶。
_Avoid_: 負債帳戶 (debt account)、卡片 (card)

**Available Balance (淨可用餘額)**:
名下隨身現金錢包與活存銀行存款總額（含主帳戶與預留金帳戶），扣除所有信用卡總欠款（已出帳與未出帳）後的實質淨可用資產。
_Avoid_: 淨值 (net worth)、可用額度 (credit limit)、總餘額 (total balance)

**Disposable Cash (真實可支配現金)**:
淨可用餘額（`available`）先隔離扣除「已存放在預留金帳戶內之專款餘額（`reserveBalance`，因屬於專款專用給未來跨期帳單之準備金，不可當作當月日常自由零用錢花掉）」，再進一步扣除「當月尚待從主帳戶預留／提撥之週期支出（`remainingMonthlyFixed`：包含當月未繳短週期支出，以及長週期項目**含預留不足往後平攤追補額**後之本月應提撥金額，扣除當月已繳）」、進行中儲蓄目標每月預留款（`monthlyGoals`），以及當月剩餘未用預算預留額（`remainingBudgetReserve = max(0, 當月有效總預算 - 當月日常消費已花費)`）後的安全自由花費餘額。
_Avoid_: 零用錢 (pocket money)、空閒餘額 (free cash)、閒置資金 (idle cash)、將已鎖入預留金子帳戶的跨期準備金混入可隨意花掉的可支配現金 (mixing locked reserve sub-account funds into free disposable cash)、將當月已繳納之週期帳單與每月平均預留重複雙扣 (double-deducting already-settled recurring items on top of reduced account balance)、將完整每月總預算與當月已發生消費重複雙扣 (double-deducting full monthly budget on top of already spent transactions)

**Explicit Account Selection (顯式帳戶選取原則)**:
在新增交易記帳、帳戶互轉、信用卡還款與公帳報銷等表單中，系統嚴格禁止擅自預選任何帳戶或信用卡（無自動預設值），強制使用者主動檢視並選取會計主體；未選取時表單透過原生 required 與介面警示進行防呆攔截。必填欄位之佔位項目設為 disabled 禁止反選回空；非必填之週期收支則提供「無特定帳戶」並允許選取與切換。
_Avoid_: 隱性預選 (implicit default)、首項默認 (first item auto-select)、自動代入 (auto-fill assumption)

**Recurring Preset Selection (週期項目記帳預設帶入)**:
在「總覽頁快速記帳」與「收支明細頁新增收支紀錄」之新增模式中（編輯模式不顯示），提供可選之「帶入週期項目」下拉選單作為純表單範本：
1. **類型過濾與公私帳顯示**：依表單當前選取之「支出 / 收入」類型動態過濾顯示對應週期項目（若該類型無週期項目則隱藏此選單），清單同時包含使用者有權限檢視之個人私帳與家庭公帳週期項目，並標示 `[公帳]`／`[私帳]` 與金額以便辨識。
2. **嚴格遵守顯式帳戶原則之欄位帶入**：選取週期項目後，僅覆寫帶入該項目之「金額」與「備註（項目名稱）」（並沿用既有備註關鍵字自動推薦分類之邏輯），使用者仍可自由修改；嚴禁連帶預選帳戶，公私帳歸屬與扣款帳戶皆維持手動檢視選取。
3. **重置與獨立生命週期**：切換回未選取預設選項時保留已填寫之金額與備註不清空；切換支出／收入類型時重置下拉選單為未選取。送出後建立之收支紀錄與週期項目及現金流預測「已繳」狀態各自獨立，不建立自動關聯。
_Avoid_: 套用週期範本時擅自預選帳戶破壞顯式帳戶原則 (auto-selecting account on recurring preset violating explicit account selection)、將純範本帶入與預測已繳狀態強耦合 (coupling form preset with forecast settled state)

---

### 信用卡帳務與結算 (Credit Card Debt & Settlement)

**Billed Debt (已出帳待繳款)**:
發卡銀行已完成結帳並發送帳單，約定於繳款日前繳納之確定欠款額。
_Avoid_: 帳單餘額 (statement balance)、本期帳單 (invoice)、應繳款 (current bill)

**Unbilled Debt (未出帳款)**:
自最近一次結帳日後刷卡產生、尚未列入正式帳單的累計消費負債。
_Avoid_: 浮動欠款 (floating debt)、未入帳 (pending charges)、暫估款 (accrued)

**Statement Day (結帳日)**:
發卡機構每月結算消費並產出帳單的固定排程日。
_Avoid_: 關帳日 (closing date)、截帳日 (cut-off date)、計費週期 (billing cycle)

**Payment Due Day (繳款日)**:
持卡人應繳清本期已出帳待繳款以避免循環利息的最後繳納期限日。
_Avoid_: 到期日 (due date)、繳納日 (payment date)、截止日 (deadline)

**Credit Card Repayment (信用卡扣款還款)**:
從指定銀行存款扣款以償還信用卡欠款的沖銷程序（系統同時建立一筆銀行帳戶端之 `expense`「信用卡還款」與一筆信用卡端之 `income`「信用卡還款」沖銷流水）。統計分析消費分類圓餅圖（Category Breakdown）維持僅統計日常消費分類，不將「信用卡還款」混入日常消費類別佔比。
_Avoid_: 將信用卡還款混入日常消費圓餅圖分類佔比 (mixing credit card repayment into category pie chart breakdown)

**Direct Ledger Sign Aggregation & Analytics System-Category Exclusion (收支明細正負號全量直觀加總 vs 統計圖表系統移轉類別排除)**:
1. **收支明細頁 (`Transactions.tsx`) 與總覽頁當月收支結算 (`Dashboard.tsx`，取自 `GET /transactions/summary/range` 或 `GET /transactions/summary/monthly`)**：針對當前篩選條件與視角下之**所有可見收支紀錄全部納入計算**，不做任何隱藏分類剔除：
   - **總收入（與當日 `+` 收入小計）**：凡明細為正項（`type = 'income'`，畫面顯示 `+`）一律列入收入加總。
   - **總支出（與當日 `-` 支出小計）**：凡明細為負項（`type = 'expense'`，畫面顯示 `-`）一律列入支出加總。
   - **淨收支**：`總收入 － 總支出`，確保畫面列表上每一筆看得到的 `+` 與 `-` 明細加總結果 100% 與上方「總收入、總支出、淨收支」及每日小計完全吻合。
2. **統計分析頁 (`Analytics.tsx`) 與預算管理頁 (`Budgets.tsx`)**：
   - 支出分類圓餅圖（`GET /transactions/summary/category`）、預算已花費計算（`GET /budgets`）以及**统计分析頁之年度收支趨勢長條圖（`GET /transactions/summary/monthly?exclude_system=1`）**，統一**排除 4 項系統內部移轉類別（`'信用卡還款'`, `'內部轉帳'`, `'ATM提款'`, `'公帳代墊報銷'`）**，真實反映日常消費支出與實質收入趨勢，避免內部轉帳或收到公帳代墊報銷款虛增年度收支長條圖。
_Avoid_: 隱藏排除特定分類導致收支明細畫面列表與上方總計數字兜不攏 (silently excluding categories on transaction ledger so visible rows do not sum to totals)、將內部轉帳或公帳代墊報銷混入統計分析之年度收支趨勢長條圖導致收支虛胖 (mixing internal transfers or advance reimbursements into analytics annual trend bar chart)

**Statement Rollover & Idempotent Recalculation (結帳日出帳作業與冪等真實明細重算)**:
結帳日到達前後，在持卡人尚未手動點擊「出帳作業」確認前，當期刷卡消費（含結帳日當天及該結帳週期內明細）一律維持為未出帳（`is_billed = 0`）並保留於「未出帳款（`unbilled`）」顯示，嚴禁於結帳日當天自動將未出帳歸零或未經出帳作業即覆寫為 `is_billed = 1`。當使用者點擊「出帳作業」時，系統開啟**出帳作業預覽彈窗（Statement Rollover Modal）**，並採行**客觀區間推算、全量未結透視、重複出帳覆蓋與真實明細冪等重算機制（ADR-0030）**：
1. **客觀結算區間推算與全量未結透視（Objective Cycle Interval & Full Unbilled Scope）**：
   - **未設定結帳日卡片之強制約束**：卡片必須設定 `statement_day` 方可執行出帳作業；未設定結帳日者前端阻擋並提示先至帳戶設定填寫結帳日，後端 API 亦進行防呆校驗。
   - **未到當月結帳日（`currDay < statementDay`）之結算區間**：
     - **起始日**：**上上期結帳日隔天（$S_{\text{prev2}} + 1$）**（例如今日 10/17，結帳日 25 號：上上期為 8/25，起始日為 `2026-08-26`）。
     - **結束日**：**上期結帳日（$S_{\text{prev1}}$）**（例如 `2026-09-25`），即最近一期已結帳之完整對帳單區間。
     - **彈窗頂部說明**：標示為 `「YYYY-MM-DD ～ YYYY-MM-DD（當月 N 號結帳日未到，結算上期帳單）」`。
   - **當月結帳日已達或已過（`currDay >= statementDay`）之結算區間**：
     - **起始日**：**上期結帳日隔天（$S_{\text{prev1}} + 1$）**（例如今日 10/17，結帳日 15 號：上期為 9/15，起始日為 `2026-09-16`）。
     - **結束日**：**本月結帳日（$S_{\text{curr}}$）**（例如 `2026-10-15`），即本期已結帳之完整對帳單區間。
     - **彈窗頂部說明**：標示為 `「YYYY-MM-DD ～ YYYY-MM-DD（當月 N 號結帳日已過，結算本期帳單）」`（若當日即結帳日則顯示 `今日為 N 號結帳日，結算本期帳單`）。
   - **僅真正勾選延至下期之歷史款項納入上期延入（`defer_to_next_statement = 1`）**：早於起始日（即 `date <= prevStatementDate`）之歷史款項，**僅當其明確標記「延至下期」（`defer_to_next_statement = 1` 且 `is_billed = 0`）或已於本期出帳之原延入款（`billed_statement_date = statementDate`）**時，方納入出帳清單並醒目標示 `[上期延入]`（打開彈窗時一律預設列入計算、預設取消勾選延至下期）。若早於起始日且未勾選延至下期（`defer_to_next_statement = 0`），則**不納入出帳作業清單亦不列入「剩餘未出帳」預估**，並於執行「確認出帳」或手動「校準」時自動標記為已出帳（`is_billed = 1, billed_statement_date = prevStatementDate`），移出未出帳並歸入已出帳待繳款。
   - **全週期明細透視與無狀態依賴**：不論過去是否曾有點擊出帳紀錄，每次打開彈窗皆依上述客觀規則計算區間，不依賴歷史出帳時間戳記推進月份，完整支援重複開啟核對與重新出帳覆蓋。
2. **四層摘要指標結構與公私帳拆解預覽**：
   - **第一行（主指標）**：`本期出帳淨額 $金額 ({筆數} 筆)`（`= 刷卡金額 - 刷退折抵 = 本期新增 - 本期延後 + 上期延入`，括號為實際列入出帳之總交易筆數）。
   - **第二行（收支拆解）**：`刷卡金額：$金額 ({筆數} 筆)，刷退折抵：-$金額 ({筆數} 筆)`（分別統計實際列入出帳之刷卡消費與刷退總和及其筆數）。
   - **第三行（來源與延後恆等拆解）**：`本期新增：$金額 ({筆數} 筆)，本期延後：$金額 ({筆數} 筆)，上期延入：$金額 ({筆數} 筆)`（其中 `本期新增` 固定為當期區間內全部交易淨額與總筆數，不隨勾選延後變動，使 `本期新增 - 本期延後 + 上期延入 = 本期出帳淨額` 恆成立）。
   - **第四行（未出帳預估）**：`剩餘未出帳：$金額 ({筆數} 筆)`（結帳日後新增未出帳淨額 ＋ 本期延後淨額，及對應總筆數）。
   - **公帳代墊報銷狀態與責任分流（Household Reimbursement Liability Shift，ADR-0029）**：
     - **待報銷代墊（`is_shared = 1 且未報銷`）**：標示 `[公帳 · 待報銷]` 徽章，計入本期公帳應付欠款（`sharedDebt`），公帳刷退優先折抵此項。
     - **已報銷代墊（`is_shared = 1 且已於家庭報銷結清`）**：清單中標示 `[公帳 · 家庭已報銷]` 徽章。因家庭共同基金已先行撥款補償持卡人，故在出帳預覽拆解中**不重複計入公帳欠款（`sharedDebt` 為 0）**，全額轉列為持卡人個人應繳私債（`personalDebt`），由持卡人自負向發卡機構繳費責任。
3. **明細檢視、動態延期與重複出帳覆蓋（Repeat Rollover & State Overwrite）**：
   - 清單依交易日期排列，並以語意徽章明確標示：`[上期延入]`（歷史週期遞延而來、預設納入本期出帳結算）、`[延至下期]`（於當期被指定遞延至下一週期並劃線扣除）。
   - **彈窗開啟時延期勾選狀態**：
     - **上期延入項目（`is_prior_deferred = true`，即早於本次結算起始日 `date <= prevStatementDate`）**：即使先前資料庫帶有 `defer_to_next_statement = 1`，開啟出帳預覽彈窗時**一律預設取消勾選「延至下期」（`is_initially_deferred = false`）、預設直接列入本次出帳計算（不劃線扣除）**。
     - **本期區間內項目（`is_prior_deferred = false`）**：若在當期被標記為延至下期（`defer_to_next_statement = 1 且 is_billed = 0`），開啟彈窗時維持勾選為 `[延至下期]`（`is_initially_deferred = true`）；其餘項目（無論原為 `is_billed = 1` 或 `is_billed = 0`）一律預設為納入本次出帳。持卡人可自由手動重新勾選或取消延期。
   - **出帳結果全面覆蓋**：按下確認出帳時，清單內未延期項目全面寫入 `defer_to_next_statement = 0, is_billed = 1, billed_statement_date = statementDate`，延期項目寫入 `defer_to_next_statement = 1, is_billed = 0, billed_statement_date = NULL`，全面覆蓋前次出帳標記。
4. **真實明細冪等重算與前期已結清差額封存（Ground-Truth Recalculation & Prior-Cycle Surplus Isolation，ADR-0045）**：使用者確認出帳（或手動點擊「校準」）時，系統更新明細之出帳與延期狀態，並根據整張卡片之已出帳消費、已出帳刷退及還款紀錄精確重算 `balance`（已出帳待繳款）與 `unbilled`（未出帳款），徹底捨棄盲目的純增量累加（`balance = balance + rolled`）。針對具有當期出帳週期（`latest_stmt = MAX(billed_statement_date)`）之卡片，**前期歷史帳單（早於 `latest_stmt`）扣除已封存歷史還款（`is_billed = 1` 之還款）後的未結清餘額以 `Math.max(0, priorNetBilled - sealedRepay)` 夾零封存**——若前期因曾刪除／修改歷史已出帳消費或歷史溢繳產生負差額，自動歸零封存，**嚴禁跨期偷扣或折抵當期新出帳之 `balance` 與私帳待繳金額（`billed_personal_debt`）**；當期 `balance` 僅扣除當期未封存之有效還款（`is_billed = 0` 之還款），確保確認出帳送出後的「已出帳待繳款總額」與「公／私帳拆解」100% 等於出帳預覽確認金額。
_Avoid_: 盲目累加導致重複點擊出帳金額疊加 (blind incremental balance addition causing double-count)、未到結帳日硬卡歷史區間排擠當前消費 (locking to legacy statement cycle before statement day and omitting current unbilled charges)、出帳過一次後再次開啟被強制跳月無法重複覆蓋 (forced month-increment after initial rollover blocking overwrite)、未設定結帳日卡片盲目出帳 (blind rollover for cards without statement day)、上期延入款進入本期被持續排除導致永久無法出帳 (perpetually excluding prior-cycle deferred items from current statement)、出帳後即變為空清單無法重新檢視調整 (empty list blocking re-inspection after initial rollover)、盲目確認無明細預覽之黑盒子出帳 (black-box rollover without preview)、結帳日未經手動出帳即自動歸零未出帳 (auto-zeroing unbilled on statement day before manual rollover)、公帳代墊已於家庭報銷出帳時仍算作公帳欠款導致雙重討債 (counting already-reimbursed shared advances as sharedDebt during rollover causing double-claim)

**Deferred Statement Billing (延至下期帳單與跨期延入生命週期)**:
在記錄或編輯信用卡消費、或於出帳作業預覽彈窗中，標記該筆收支延至下個結帳週期再行出帳與沖抵的屬性（`defer_to_next_statement`），適用於商家延遲請款、爭議款或跨期退款。其生命週期嚴格劃分為兩大情境：
1. **上期延入款 (Prior-Cycle Deferred Item)**：凡交易日期早於或等於上期結帳日（`date <= prevStatementDate`）且**明確標記「延至下期」（`defer_to_next_statement = 1`）**之未出帳消費（`is_billed = 0`）。進入後續結帳或提前出帳作業時，其商業語意為「遞延至本次出帳」，因此在出帳作業預覽彈窗中**一律預設自動喚醒納入出帳（`is_initially_deferred = false`）**，清單中醒目標示為 `[上期延入]`，金額不劃線並計入出帳淨額；若當期商家依然未請款，持卡人仍可再次點擊「延至下期」繼續順延。反之，早於上期結帳日且未標記延至下期（`defer_to_next_statement = 0`）之歷史未結明細，不列入 `[上期延入]` 亦不納入出帳作業，並於確認出帳或手動校準時自動轉為已出帳（`is_billed = 1`）。
2. **本期遞延下期款 (Current-Cycle Deferred Item)**：於當期出帳作業預覽中被持卡人勾選「延至下期」之交易（或於當期已出帳作業中被記錄延期者）。當期出帳時排除於出帳淨額外，維持未出帳（`is_billed = 0, defer_to_next_statement = 1`），並於下個結帳週期自動成為「上期延入款」。
當使用者在收支明細中手動編輯勾選「延至下期帳單」（或將收支日期改至最近結帳日之後）時，系統將該筆收支重置為未出帳（`is_billed = 0`），並同步重算該信用卡之未出帳金額（`unbilled`）。在信用卡未出帳自癒校準（`reconcileCreditCardUnbilled`）中，嚴格維持延期款之 `defer_to_next_statement = 1` 與 `is_billed = 0` 屬性，嚴禁因日期早於基準結帳日而強制覆寫為 `is_billed = 1`。
_Avoid_: 上期延入款進入本期被持續排除導致永久無法出帳 (perpetually excluding prior-cycle deferred items from current statement)、未到結帳日無法將延期款喚醒出帳 (inability to awaken deferred items before statement day)、校準時強制覆寫延期款為已出帳 (reconciliation forcefully overwriting deferred items to is_billed = 1)、延遲繳款 (delayed payment)、跨期借貸 (cross-period loan)、下期消費 (next cycle expense)

**Billed Status (出帳狀態)**:
每筆信用卡收支之結算狀態標記（is_billed），明確劃分「未出帳 (0)」與「已出帳 (1)」，作為帳單出帳作業、收支明細徽章顯示與未出帳自動校準之絕對準則。`is_billed = 1` 僅能由使用者手動執行「出帳作業（Statement Rollover）」寫入；嚴禁於系統啟動遷移或一般校準時，將尚未執行出帳作業之當期交易強制覆寫為 `is_billed = 1`。
_Avoid_: 帳單狀態 (bill status)、結案標記 (settled flag)、未經出帳作業強制覆寫為已出帳 (prematurely overwriting unbilled transactions to is_billed = 1 on statement day)

**Two-Tier Debt Rollback (雙層負債回退)**:
當編輯或刪除歷史刷卡消費收支時，負債回退程序優先扣減未出帳款（Unbilled Debt）；若未出帳款已不足扣（款項已於結帳日出帳作業中結轉至已出帳或已被還款沖銷），剩餘回退差額自動溢出扣減已出帳待繳款（Billed Debt），確保欠款全額精準返還。若為同帳戶編輯，應先計算新舊收支之單一淨差額（Single Net Delta）再行回退或認列，嚴禁分步覆蓋。
_Avoid_: 雙步覆蓋 (two-step overwrite)、夾零截斷 (zero clamping)、已出帳凍結 (billed freeze)

**Credit Card Balance Reconciliation (信用卡未出帳自動校準)**:
針對信用卡帳戶，採行**讀寫分離與批次聚合原則**：僅於使用者手動點擊「校準」或發生信用卡收支／帳務異動（新增、編輯、刪除信用卡收支、機器人記帳、出帳作業）時，系統依據該卡之結帳日與實際最近一次手動出帳紀錄（`last_rollover_at`）執行**狀態自癒與未出帳淨額寫入校準**；而載入帳戶列表與查詢淨可用餘額時則維持**純唯讀批次聚合計算**（零資料庫寫入、無逐卡 N+1 迴圈）：
1. **未經手動出帳之當期交易保護與自癒復原**：若當前日期已達或超過本期結帳日（$S_{\text{cutoff}}$），但該卡於本期結帳日當天或之後尚未執行過手動「出帳作業」（即 `last_rollover_at` 為空或早於 $S_{\text{cutoff}}$），則本期結帳週期（`date > S_prev`）仍屬於「待手動出帳之未出帳區間」，系統於校準時自動將該區間內曾被誤標為 `is_billed = 1` 之交易修復還原為 `is_billed = 0`（未出帳），絕不提前將 `date <= S_cutoff` 強制改為 `is_billed = 1`。
2. **純粹未出帳淨額加總**：精準加總所有 `is_billed = 0` 之未出帳區間內「有效消費支出總額 － 刷退退款總額」（$$\max(0, \sum \text{未出帳消費} - \sum \text{未出帳刷退})$$），完全不扣減 `unbilled_offset` 還款紀錄以免溢扣上期繳卡費，並透過批次聚合即刻計算公私帳刷卡分流（`shared_debt` 與 `personal_debt`）。
_Avoid_: 讀取帳戶列表或餘額時夾帶資料庫寫入與逐卡 N+1 迴圈 (side-effect DB writes or N+1 per-card queries during read requests)、結帳日當天未按出帳作業卻把未出帳強制歸零 (zeroing unbilled on statement day before manual rollover)、全額還款扣減 (full repayment deduction)、溢繳還款誤扣 (unbilled_offset deduction)

**Two-Dimensional Credit Debt Matrix (信用卡雙層公私債務矩陣)**:
將信用卡欠款在「出帳狀態維度（已出帳待繳 `balance` vs 未出帳累計 `unbilled`）」與「責任主體維度（家庭代墊公帳 `shared` vs 個人私帳 `personal`）」進行四維結構化拆解：
1. **已出帳公帳待繳款 (`billed_shared_debt`)**：當期已出帳明細中屬於家庭公帳代墊之淨額，為銀行當期帳單中應由家庭共同基金撥付繳納之法定金額。
2. **已出帳私帳待繳款 (`billed_personal_debt`)**：當期已出帳明細中屬於持卡人個人私帳之淨額，應由持卡人個人帳戶自行承擔繳納。
3. **未出帳公帳累計 (`unbilled_shared_debt`)**：未出帳區間內累積之家庭代墊消費淨額，代表下期或後續出帳時將轉入之代墊款。
4. **未出帳私帳累計 (`unbilled_personal_debt`)**：未出帳區間內累積之持卡人個人私密消費淨額。
5. **還款預設與沖銷順序**：點擊「繳家庭代墊」時，若有已出帳公帳（`billed_shared_debt > 0`），系統預設代入「已出帳公帳」金額，避免共同基金提早溢繳尚未出帳之消費，並於繳款彈窗中提供快捷切換；共同基金還款流水（`is_shared = 1`）優先沖銷已出帳公帳，餘額溢出方沖銷未出帳公帳。
6. **他人私卡公帳視角脫敏防線**：在家庭公帳視角或非持卡人檢視伴侶之個人私卡時，清楚揭露 `billed_shared_debt` 與 `unbilled_shared_debt`，並提供「繳家庭代墊」操作；而個人私帳金額（`credit_limit`、`billed_personal_debt`、`unbilled_personal_debt`、`balance`）全面落實隱私脫敏遮蔽。
7. **當期帳單獨立結算邊界與上限約束（ADR-0037、ADR-0045）**：全系統（帳戶列表 `GET /accounts`、淨可用資金 `GET /accounts/balance`、現金流預測 `GET /forecast` 與出帳作業 `rollover-preview` / `rollover-statement` / `recalculateCardBalances`）一律以交易之真實出帳狀態（`is_billed = 1 AND defer_to_next_statement = 0` 與 `billed_statement_date`）作為已出帳／未出帳與當期帳單組成之唯一判準。前期已結清帳單之歷史差額（無論來自全額結清公私歸屬差額、事後家庭報銷改標，或曾刪除／修改歷史已出帳消費造成的負差額）自動以 `Math.max(0, ...)` 封存歸零，嚴禁跨期溢扣或侵蝕本期新出帳之 `balance` 總額與公私帳拆解；本期 `billed_shared_debt` 與 `billed_personal_debt` 各自嚴格受「本期實際出帳之公帳／私帳淨額（扣除當期對應還款）」上限約束（例如本期僅有公帳 $637、私帳 $0，出帳後必為 `公 $637 · 私 $0`；若前期已結清，本期確認出帳多少，出帳後 `balance` 與公私拆解必 100% 等於確認出帳金額）。當編輯或刪除已出帳（`is_billed = 1`）之信用卡收支時，系統同步觸發 `recalculateCardBalances` 與 `reconcileCreditCardUnbilled` 即時重算已出帳待繳款與未出帳款。
8. **「全額結清」智慧預設歸屬（ADR-0037）**：點擊信用卡「全額結清」開啟繳款彈窗時，若卡片僅有私帳欠款（`shared_debt <= 0` 且 `personal_debt > 0`）或預設扣款銀行為個人私帳（`is_joint = 0`），預設歸屬為「個人私帳還款 (`is_shared = 0`)」；若預設扣款銀行為家庭共同帳戶（`is_joint = 1`）或僅有公帳欠款，則預設為「家庭公帳還款 (`is_shared = 1`)」；且切換扣款銀行帳戶時若尚未手動鎖定，可聯動對齊扣款帳戶之公私性質。
_Avoid_: 混淆已出帳與未出帳導致公帳盲目全額溢繳 (mixing billed and unbilled causing premature joint fund payment)、他人私卡揭露個人私帳金額 (leaking personal debt details of other members' cards)、全歷史還款差額跨期污染新帳單公私拆解 (lifetime repayment deficit polluting current cycle shared/personal breakdown)、讀取端自行用日期切點推算未出帳導致與 `is_billed` 脫節 (divergent cutoff-date heuristic vs `is_billed` truth)

**Credit Card Default Payment Account & Bank Auto-Debit Liability Projection (信用卡預設扣款帳戶與銀行待扣款負債預覽)**:
在信用卡帳戶（`type = 'credit_card'`）上支援綁定「預設扣款銀行帳戶（`payment_account_id`）」，串聯信用卡繳費預設帶入、信用卡端之扣款銀行餘額／充足度即時檢視，以及銀行存款卡片之待扣款負債預警：
1. **信用卡預設扣款帳戶設定與卡片雙向顯示**：
   - 於新增或編輯信用卡彈窗中，提供「預設扣款銀行帳戶（選填）」下拉選單（可選擇銀行存款帳戶 `type = 'bank'` 或「不綁定」）。
   - **已綁定扣款帳戶之獨立資訊列（含存款餘額與跨卡充足度狀態）**：
     - 後端 `GET /accounts` 一併回傳綁定扣款銀行之名稱（`payment_account_name`）、即時存款餘額（`payment_account_balance`）、公私歸屬（`payment_account_is_joint`）以及該扣款銀行名下綁定之所有信用卡總數與合計已出帳待扣總額（`payment_account_bound_count`、`payment_account_bound_billed_total`），確保即使切換至「公帳」視角（私帳銀行不在當前視角帳戶清單中）或同一銀行綁定多張信用卡時，仍能呈現真實扣款水位。
     - 於「帳戶管理 (`Accounts.tsx`)」之信用卡卡片帳單週期區下方，呈現獨立清晰之預設扣款帳戶資訊框：顯示扣款銀行名稱、目前存款餘額，以及存款充足度狀態徽章（以 `扣款銀行存款餘額 vs 該銀行綁定之所有信用卡已出帳待扣總額` 判定：當總已出帳待扣 `> 0` 且存款充足時顯示綠色「餘額充足」徽章；若存款不足扣繳已出帳總額則以醒目危險紅字 `var(--color-danger)` 警示「存款不足（差額 $X）」；若綁定超過 1 張卡則附註「共綁定 N 張卡」）。
   - **未綁定扣款帳戶之明確狀態與快捷設定入口**：
     - 當信用卡尚未綁定預設扣款銀行（且非他人脫敏私卡）時，不再完全隱藏該列，而是明確顯示「預設扣款帳戶：未設定」，並對有編輯權限之使用者提供「設定扣款帳戶」快捷按鈕（點擊直接開啟該信用卡之編輯彈窗）。
   - **儀表板 (`Dashboard.tsx`) 信用卡摘要卡片同步精簡呈現**：
     - 在總覽頁「帳戶一覽」之信用卡卡片中，同步顯示精簡版扣款帳戶資訊列（已綁定時顯示 `扣款：銀行名 · 餘額 $X` 與充足／不足狀態徽章；未綁定且非脫敏私卡時顯示灰色 `預設扣款帳戶：未設定`）。
   - **公私帳隱私揭露邊界**：
     - 若信用卡綁定之扣款銀行為「家庭共同基金銀行（`is_joint = 1`）」，全體家庭成員皆可見該扣款銀行名稱、餘額與扣繳充足狀態；若綁定的是「持卡人個人私帳銀行（`is_joint = 0`）」，則嚴格僅持卡人本人可見，其他家庭成員檢視該卡（無論為他人私卡或家庭共同卡）時，後端強制將 `payment_account_id`、`payment_account_name`、`payment_account_balance` 等欄位脫敏設為 `null`，絕不洩漏個人私帳銀行名稱與存款餘額。
2. **結清還款彈窗預設帶入**：
   - 點擊信用卡之「繳家庭代墊」、「繳個人私帳」或「全額結清」開啟還款彈窗時，系統**一律優先自動帶入該信用卡所綁定之 `payment_account_id`**（只要該銀行帳戶在當前可用扣款銀行清單中）；僅當協助他人私卡繳納家庭代墊款（看不到對方私帳銀行）或未設定預設扣款帳戶時，才退回帶入家庭共同基金帳戶或請使用者選擇。
3. **扣款銀行卡片待扣款金額與扣後餘額預覽**：
   - 當某銀行存款帳戶被一張或多張信用卡設為 `payment_account_id` 時，於該銀行存款卡片（含「帳戶管理 `Accounts.tsx`」與「儀表板 `Dashboard.tsx`」）即時聚合顯示綁定信用卡之待扣款資訊：
     - **已出帳待扣款**：加總綁定信用卡之當期已出帳待繳金額（`billed`），代表即將到期扣款之確定負債。
     - **含未出帳總待繳**：加總綁定信用卡之總負債（`billed + unbilled`）。
     - **扣款後預估餘額**：顯示 `存款餘額 － 已出帳待扣款`（及 `扣總待繳後預估餘額`），若存款餘額不足以支付已出帳待扣款（或總待繳）時，以醒目危險紅字（`var(--color-danger)`）警示餘額不足差額。
     - **綁定卡片明細**：列出綁定於此銀行帳戶之各張信用卡名稱與待繳金額。
_Avoid_: 每次繳卡費都需手動重選固定扣款銀行 (forcing manual bank selection on every repayment when auto-debit bank is fixed)、銀行存款餘額看似充裕卻忽略即將自動扣繳之綁定卡費導致餘額不足違約 (ignoring bound credit card auto-debit liabilities on bank cards)、未綁定扣款帳戶時完全隱藏欄位導致使用者不知可綁定 (hiding payment account info completely when unset)、信用卡端僅比對單卡已出帳卻忽略同銀行綁定多卡之合計待扣金額 (checking single-card billed debt against bank balance while ignoring other cards bound to the same bank)、向非持卡人洩漏綁定之個人私帳銀行名稱與存款餘額 (leaking personal payment bank name or balance to other household members)

---

### 家庭公帳與共同基金 (Household & Joint Fund)

**Household (家庭群組)**:
兩位使用者綁定、能共享家庭公帳收支並檢視家庭財務數據的關聯組織。
_Avoid_: 團隊 (team)、群組 (group)、家庭 (family)

**Shared Expense (家庭公帳)**:
為家庭全體利益與生活日常支出，標記為全體成員共享之消費支出。
_Avoid_: 共同開銷 (joint expense)、公費 (public cost)、公攤 (group cost)

**Personal Expense (個人私帳)**:
僅家庭中個別成員個人享受、非家庭共用之獨立收支。
_Avoid_: 私帳 (private expense)、個人支出 (self expense)、自付額 (own cost)

**Account Ownership (帳戶歸屬)**:
帳戶所屬之會計主體標記（is_joint），劃分為「個人私帳 (is_joint = 0)」與「家庭公用 (is_joint = 1)」。
_Avoid_: 私有歸屬 (private owner)、群組共有 (group owned)

**Joint Fund (家庭共同基金)**:
歸屬於家庭公用（is_joint = 1）之正資產帳戶（包含銀行存款帳戶與公款現金錢包），成員定額注資，專門用於家庭公帳買單或撥付代墊款報銷。
_Avoid_: 公費池 (common pool)、家庭帳戶 (family account)、公款 (public fund)

**Joint Credit Card (家庭信用卡)**:
歸屬於家庭公用（is_joint = 1）之信用卡負債帳戶，全體家庭成員共同檢視未出帳款與刷卡消費流水。
_Avoid_: 共享卡 (shared card)、附卡 (supplementary card)

**Personal Cash Advance (個人現金公帳代墊)**:
個別成員在日常生活中掏出個人現金錢包為家庭公帳支付支出，系統自個人現金錢包扣款並登記為家庭支出，並登記為公帳代墊款待報銷。扣款帳戶若為家庭共同帳戶則屬於家庭直接開銷，不計入代墊。
_Avoid_: 墊現鈔 (cash upfront)、自掏腰包 (out-of-pocket)

**Advanced Payment (公帳代墊款)**:
個別成員以個人私帳、個人信用卡或個人現金為家庭公帳代付之款項。凡扣款帳戶為個人帳戶（is_joint = 0）之公帳支出即為代墊款；直接由共同基金（is_joint = 1）扣款者為家庭直接開銷，嚴格排除於代墊款之外。
_Avoid_: 代付 (upfront pay)、個人借款 (loan to family)、代付款 (advance)

**Reimbursement (報銷沖帳)**:
從家庭共同基金直接撥款轉帳至個人帳戶，以沖銷成員累積之家庭公帳待報銷款項的平帳作業。
_Avoid_: 結算 (settlement)、退款 (refund)、還錢 (payback)、一鍵報銷 (one-click reimburse)

**Itemized Advance Selection & Reimbursed Lifecycle (勾選指定代墊沖帳與明細生命週期)**:
在家庭協同單元中執行「報銷沖帳」時，系統支援**依墊付帳戶分組與逐筆勾選指定代墊明細**之分批沖帳機制：
1. **報銷彈窗依墊付帳戶分組與一鍵快選（Account-Grouped Advance Selection & Single Account Shortcut）**：點擊「報銷沖帳」時，彈窗內待報銷明細自動依「墊付帳戶」分組呈現（標註各帳戶名稱、圖示、筆數與小計），勾選區塊高度加大至 `min(320px, 42vh)` 提供舒適可視空間，預設全部勾選。每個帳戶分組標題列附帶專屬 Checkbox 支援一鍵整卡／整戶全選或取消，並提供「僅選此帳戶」快捷按鈕（一鍵清空其他帳戶、僅保留該帳戶的所有勾選）；分組內亦可展開逐筆勾選微調，報銷金額由所勾選項目的金額總和即時動態連動，免去手動計算。
2. **家庭協同待報銷清單自動結清移出（Auto-Removal from Advance Pending List）**：一旦確認撥款報銷，被勾選結清之代墊消費記錄其報銷流水關聯，並**即刻從家庭協同的「待報銷消費明細」中移出**，使家庭協同單元維持極致精簡、僅呈現當前尚未結清的墊付責任。
3. **收支明細精準三態徽章（Three-Tier Shared Status Badges）**：在全站收支明細列（`Transactions` / `TransactionRow`）中，公私帳標籤依支付來源與報銷狀態精準分流：
   - **家庭共同帳戶直接扣款之公帳（非代墊）**：標示 **`[公帳]`** 藍色徽章。
   - **個人私帳／私卡／現金墊付且尚未撥款之公帳（待報銷）**：標示 **`[公帳 · 待報銷]`** 暖橘色徽章。
   - **個人墊付且已由共同基金撥款報銷之公帳（已結清）**：標示 **`[公帳 · 已撥款]`** 柔綠色徽章。
   - **個人私帳**：維持 **`[私帳]`** 紅色鎖頭徽章。
4. **代墊報銷與出帳解耦並行及狀態透視（Decoupled Parallel Lifecycle & Status Transparency）**：
   - **隨刷隨報**：個人信用卡代墊公帳時，家庭代墊報銷與信用卡出帳各自獨立並行，不強制等待信用卡出帳日，隨時可於家庭協同申請撥款實報實銷。
   - **出帳狀態透明透視**：待報銷明細清單與報銷彈窗中，信用卡代墊款項完整透視其出帳狀態，清楚標示 **`[未出帳]`**、**`[已出帳]`** 或 **`[延至下期]`** 語意徽章；即使款項在信用卡端被標記為「延至下期」，仍允許正常勾選報銷，不剝奪成員請款權益。
   - **公帳退款與負數抵扣防線**：公帳刷退／退款（`type = 'income', is_shared = 1`）作為負數項目即時抵減成員待報銷總額。若累計待報銷淨額小於 0，系統明確標示為「公帳待抵扣」，並停用撥款報銷按鈕，留待成員後續代墊時自動平帳沖抵。
   - **已報銷／沖銷信用卡待繳負債全系統轉列私帳（原消費維持公帳）**：
     - **原消費紀錄維持公帳**：交易本身之 `is_shared = 1` 永不改變，在「收支明細」、「統計分析」與「當月公帳支出統計」中依然 100% 列為家庭公帳支出。
     - **信用卡待繳責任轉移（公帳 → 私帳）**：一旦個人私卡（`is_joint = 0`）上的公帳消費已在家庭協同完成「報銷沖帳」或「標記已額外處理」（即 `reimbursement_id` 非空），對家庭公帳而言該筆代墊已結清，不再記入信用卡公帳待繳（`billed_shared_debt` / `unbilled_shared_debt`）；該筆尚未繳給銀行的待扣款金額全額轉列為持卡人**個人私帳待繳（`billed_personal_debt` / `unbilled_personal_debt`）**，並在**現金流預測（`Forecast`）**（改由「私帳」視角之繳卡費事件扣款，不再扣公帳）、**信用卡卡片公帳代墊顯示與繳卡費彈窗（`Accounts` / `Dashboard`）**、**出帳作業（`Rollover`）**及**淨可用資金（`Balance`）**中全系統一致套用。
   - **清償雙軌並行互補**：家庭共同基金償付成員個人信用卡代墊款支援雙軌：
     - **軌道一（家庭協同報銷／沖銷）**：自共同基金撥款至成員個人銀行／現金帳戶（或標記已額外處理），結清後該筆待繳卡費即刻轉由成員個人私帳自負向發卡機構繳費。
     - **軌道二（帳戶列表繳家庭代墊）**：針對尚未在家庭協同報銷之代墊款，自共同基金直接還款至信用卡，直接沖減信用卡之公帳待繳債務（`billed_shared_debt`）。
5. **已額外處理直接結清移出清單（External Advance Settlement without Joint Fund Transfer）**：
   - **雙入口勾選與一鍵移出**：
     - **入口一（「報銷沖帳」彈窗內）**：勾選公帳代墊項目後，除「確認撥款沖帳」外，提供「已額外處理（僅移出清單・不扣款）」操作按鈕，無須選擇共同基金與收款帳戶即可將勾選項目移出待報銷清單。
     - **入口二（家庭協同頁面展開之「待報銷明細」列表）**：列表支援單筆勾選與全選／取消全選，勾選後可直接點擊「標記已額外處理（移出清單）」批次結清。
   - **獨立結清標記與可逆退回（`reimbursement_id = 'EXTERNAL_SETTLED'`）**：
     - 被標記為已額外處理之項目寫入 `reimbursement_id = 'EXTERNAL_SETTLED'`，即刻從「待報銷明細」移入「已結清明細」分頁，並於「已結清明細」及「收支明細」標示 `[已額外處理]`／`[公帳 · 已額外處理]` 語意徽章。
     - **零資金扣款與不虛增撥款總額**：此操作**不扣減任何共同基金或個人帳戶餘額、不產生 `公帳代墊報銷` 轉帳流水**，且在計算 `溢撥預收（unlinked_reimbursed）` 時，僅針對實際關聯共同基金撥款單之結清項目（`reimbursement_id != 'EXTERNAL_SETTLED'`）與 `total_reimbursed` 比對，避免虛減溢撥預收或虛增已獲撥款報銷金額。
     - **完整支援誤按退回**：移入「已結清明細」後，管理員或該成員本人仍可隨時點擊「退回」（`POST /households/advances/:id/unlink`）將其還原回「待報銷明細」。
_Avoid_: 盲目手動輸入任意金額導致對不起來哪些項目已結清 (opaque lump-sum reimbursement without item linkage)、缺乏帳戶分組導致多卡代墊難以單卡結清 (lack of account grouping for card-specific settlement)、已結清代墊持續堆疊在待報銷清單中 (retained settled items cluttering pending advance list)、無法分辨公帳是共同基金扣款還是個人代墊 (inability to distinguish joint direct payments from personal advances)、強制卡片出帳方可報銷導致報帳延宕與漏單 (blocking advance reimbursement until credit card statement cuts causing delays)、已透過場外或繳家庭代墊處理卻強制要求動支共同基金轉帳才能移出待報銷清單 (forcing joint fund transfer to clear externally settled advances)

**Advance Items Breakdown (代墊與報銷明細)**:
家庭頁面中各成員的透明流水帳明細，包含「個人墊付公帳待報銷消費清單（日期、類別、備註、扣款個人帳戶、金額）」以及「共同基金撥款報銷沖帳紀錄」，便於雙方隨時核帳與檢驗結清狀態。
_Avoid_: 報銷單 (expense report)、請款單 (invoice)、明細表 (detail sheet)

**Household Admin (家庭管理員)**:
家庭群組之發起建立者或承接法定管理身分之核心成員，專屬享有發行邀請碼、移除家庭成員、解散家庭，以及自共同基金向任意成員撥款報銷代墊款之管理權力。
_Avoid_: 房長 (room owner)、主帳號 (master user)、超級管理員 (super admin)

**Household Member (家庭成員)**:
透過邀請碼加入家庭之協同記帳成員，享有家庭公帳檢視、共同基金選用記帳與公帳明細查詢權，並具備向本人帳戶申請自律報銷之權限，但不具備邀請新成員或移除他人之組織權力。
_Avoid_: 一般使用者 (regular user)、受邀者 (guest)、副帳號 (sub-account)

**Dual-Layer Access Control (雙層權限防禦機制)**:
為確保個人私帳絕對隱私與家庭公帳資金安全所建構之「前端介面防呆自適應隱藏」結合「後端 API 強制校驗攔截（HTTP 403 Forbidden）」之雙重防護架構。
_Avoid_: 前端阻擋 (frontend-only check)、無感報錯 (silent failure)、暴力放行 (lax bypass)

**Account Mutation Boundary (帳戶異動權限邊界)**:
個人私帳（is_joint = 0）具備不可侵犯之絕對主權，僅帳戶擁有者本人可查詢、修改或刪除，任何其他家庭成員（包含家庭管理員）皆嚴禁竄改；家庭共同帳戶（is_joint = 1）則由帳戶建立者與家庭管理員共治，非建立者之一般成員無權編輯或刪除。
_Avoid_: 帳戶共有 (open account ownership)、隨意覆蓋 (unrestricted account edit)

**Transaction Mutation Boundary (交易異動權限邊界)**:
個人私帳交易（is_shared = 0）嚴格僅限記錄者本人改刪；家庭公帳交易（is_shared = 1）採行「建立者與管理員共治原則」，僅該筆公帳記錄者本人與家庭管理員擁有編輯與刪除權，一般成員不可竄改其他成員所登載之公帳流水。
_Avoid_: 自由互改 (arbitrary peer edits)、單一擁有權死鎖 (creator-only lock)

**Paired System Transaction Edit & Delete Synchronization (成對轉帳／報銷／還款紀錄雙邊連動編刪)**:
系統內部成對產生的四類移轉／平帳紀錄（`公帳代墊報銷`、`內部轉帳`、`ATM提款`、`信用卡還款`）以 `pair_tx_id` 雙向綁定轉出端與轉入端，於「收支明細 (`Transactions.tsx`)」與「家庭協同 > 報銷紀錄 (`Family.tsx`)」解除唯讀鎖定、開放編輯與刪除：
1. **可編輯欄位限縮**：僅開放修改「金額、日期、備註」，並於同一資料庫批次中同步更新另一端流水之金額與日期，依差額校正雙邊帳戶餘額。轉出／轉入帳戶不可修改，帳戶選錯一律刪除後重記（防止報銷轉出非共同基金、收款非被報銷成員本人帳戶之越權與錯帳）。
2. **雙邊連動刪除與代墊退回**：刪除任一端即成對刪除兩筆紀錄並回滾雙邊帳戶餘額；若為 `公帳代墊報銷`，同步將綁定該報銷單之代墊消費 `reimbursement_id` 重置為 `NULL`，自動退回「待報銷明細」。
3. **異動權限**：`公帳代墊報銷` 由家庭管理員或被報銷成員本人改刪（與「解除報銷」權限一致）；`內部轉帳`／`ATM提款`／`信用卡還款` 僅限當初操作者本人或家庭管理員改刪。
4. **報銷金額與已勾選代墊之一致性防線**：報銷金額改大時，超出已勾選代墊合計之部分沿用「家庭基金溢撥／預收款」揭示；改小至低於已勾選代墊合計時禁止儲存，提示先至「已結清明細」退回部分項目。
5. **信用卡還款金額重新分配**：修改還款金額時依原繳卡費規則重新分配——先抵「已出帳待繳」，超過部分才抵「未出帳」（重算 `unbilled_offset`），並以實際明細冪等重算卡片待繳金額。
6. **歷史紀錄一次性配對**：既有無 `pair_tx_id` 之舊紀錄，以「同日、同分類、同金額、一收一支、建立時間相近」執行一次性唯一匹配並寫入配對；無法唯一配對者維持「系統保護」唯讀，避免誤改他筆。
_Avoid_: 死鎖系統保護禁止修改誤記之轉帳或報銷 (hard-locking transfer/reimbursement records against user corrections)、單邊修改導致轉出與轉入帳戶餘額失衡 (single-legged edits breaking dual-account balance parity)、刪除報銷紀錄卻遺留孤兒已報銷標記 (deleting reimbursement without returning linked advances to pending state)、編輯時改帳戶造成越權撥款 (account reassignment on edit enabling unauthorized fund routing)、模糊配對誤改他筆歷史紀錄 (ambiguous legacy pairing editing the wrong counterpart)

**Self-Discipline Reimbursement (受限自律撥款報銷)**:
一般家庭成員僅能從家庭共同基金為「本人累積之公帳代墊款」執行撥款報銷至個人正資產私帳，嚴禁越權動支基金撥款予其他成員；家庭管理員則具備全額審批與為任一成員撥款之管理權限。
_Avoid_: 自由提款 (unrestricted withdrawal)、代領 (proxy reimbursement)

---

### 帳本視角與範疇 (Ledger Scope & Filter Terminology)

**Vector SVG Icon System (全站向量圖示系統)**:
全站介面（包含導覽、頁面標題、統計卡片、空狀態插圖、三態視角切換、交易列與預測狀態徽章、27 種收支分類圖示與 12 款儲蓄目標圖示）全面採用 `lucide-react` 向量 SVG 圖示，徹底捨棄系統字型 Emoji。瀏覽器原生 `<select><option>` 下拉選單僅呈現乾淨純文字；Telegram 與 LINE 機器人純文字回覆亦移除 Emoji，改用純文字幾何排版符號（如 `▪`、`•`）。
_Avoid_: 系統字型 Emoji (system font emoji)、跨平台不一致繪文字 (platform-dependent pictographs)

**Unified Ledger Scope (統一帳本範疇體系)**:
全站各頁面（Dashboard 總覽、Transactions 收支明細、Accounts 帳戶資產、Recurring 週期收支、Budgets 預算管理、Analytics 財務分析、Forecast 現金流預測）在提供資料範圍過濾或切換檢視時，一律採用「全部 (`all`)」、「公帳 (`household`)」、「私帳 (`personal`)」三態結構，並固定搭配高對比 Lucide 向量 SVG 圖示：`Globe` 全部、`Home` 公帳、`Lock` 私帳。切換器為純選項群組，不附「檢視範圍」等標題文字；彈窗內之公帳／私帳歸屬二態按鈕沿用同一 SVG 圖示與用語。全站徹底消除「全貌合併」、「家庭公用 (共同基金/家庭卡)」、「合併」等不一致用語及任何 Emoji 符號。
_Avoid_: 全貌合併 (full merge)、檢視合併 (combined view)、家庭公用 (household common)、Emoji 視角符號 (emoji scope pictographs)

**All Scope (全部)**:
全站三態切換的首個選項（value: `all`，搭配 `Globe` 向量地球圖示），聚合呈現目前登入者之「個人私帳」以及家庭全體成員共用之「家庭公帳／共同基金」，提供全方位家庭財務與資產流水概覽。
_Avoid_: 全部 (本人 + 家庭公用) (all with verbose suffix)、全貌合併 (complete merge)、總體 (total)

**Shared Scope (公帳)**:
全站三態切換的第二個選項（value: `household`，搭配 `Home` 向量房屋圖示），專注呈現標記為家庭公用之收支流水（`is_shared = 1`）、家庭共同基金帳戶（`is_joint = 1`）與共同信用卡，完全聚焦於家庭公共生活財務。
_Avoid_: 家庭公帳 (household shared)、家庭公用 (共同基金/家庭卡) (verbose household tag)

**Personal Scope (私帳)**:
全站三態切換的第三個選項（value: `personal`，搭配 `Lock` 向量鎖頭圖示），嚴格僅呈現登入者本人名下之個人私密收支（`t.user_id = ? AND t.is_shared = 0`）、個人現金皮夾、活存銀行存款與個人信用卡（`is_joint = 0`），**徹底隔離並排除家庭公帳（包含本人以個人私帳／私卡／現金代墊之公帳 `is_shared = 1`）**與他人帳務。在後端 `buildScopeCondition`（涵蓋 `GET /transactions`、`GET /transactions/summary/range`、`GET /transactions/summary/category`、`GET /transactions/summary/monthly`）中，當 `scope === 'personal'` 時一律強制 `t.user_id = ? AND t.is_shared = 0`，絕不可因漏篩 `is_shared = 0` 而將本人代墊之公帳混入私帳明細或私帳統計中。
_Avoid_: 個人私帳 (personal account verbose)、無圖示純文字私帳 (plain text without canonical SVG icon)、私帳視角僅過濾 `t.user_id = ?` 卻漏加 `t.is_shared = 0` 導致本人代墊公帳被算入私帳支出 (omitting `t.is_shared = 0` in personal scope causing personal shared advances to pollute personal statistics and ledger)

**Account Category Filter Tabs (帳戶管理四態類別切換器)**:
在「資產與帳戶管理 (`Accounts.tsx`)」頁面中，於四大核心資產統計卡片（現金錢包總額、銀行存款總額、信用卡總待繳、淨可用餘額）正下方、各類別帳戶清單正上方，配置四態帳戶類別切換頁籤：
1. **四態選項與即時數量標示**：
   - `全部類型 (N)`（value: `all`）
   - `現金錢包 (N)`（value: `cash`，搭配 `Wallet` 向量圖示）
   - `銀行存款帳戶 (N)`（value: `bank`，搭配 `Building` 向量圖示）
   - `信用卡 (N)`（value: `credit_card`，搭配 `CreditCard` 向量圖示）
   其中括號內數量 `N` 即時反映當前公私帳視角（全部 / 公帳 / 私帳）下各類別之實際帳戶筆數。
2. **過濾範圍與統計卡片獨立性**：
   - 切換帳戶類別頁籤時，**上方四大核心資產統計卡片始終固定顯示當前公私帳視角下的全類別完整總額與淨可用餘額**，不隨類別頁籤隱藏或變動；僅下方帳戶清單區塊依所選類別過濾顯示（選取「全部類型」時依序呈現現金錢包、銀行存款帳戶、信用卡三大專區；選取單一類別時僅呈現該類別專區）。
   - 當使用者切換頂部「全部 / 公帳 / 私帳」公私帳視角時，維持當前所選之帳戶類別頁籤狀態不強制重置。
   - 新增／編輯帳戶彈窗維持原有規則：僅「新增帳戶」時可選擇帳戶類型，「編輯帳戶」時鎖定帳戶類型不可變更。
3. **行動端（`<= 640px`）2x2 等寬網格排版**：
   - 在手機小螢幕下，四態帳戶類別切換器自動排列為 `2x2` 雙欄等寬網格（`grid-template-columns: repeat(2, minmax(0, 1fr))`），確保四個類別名稱與數量完整呈現且不產生橫向捲軸。
_Avoid_: 切換帳戶類別時連動隱藏上方四大資產統計卡片導致失去全局淨可用餘額視野 (hiding top 4 summary stat cards when filtering by account category)、手機版四個長文字類別頁籤硬塞單列導致擠壓斷行或橫向捲軸 (cramming 4 category tabs with counts into a single overflowing row on mobile)、切換公私帳視角時強制重置使用者已選之帳戶類別篩選 (forcibly resetting selected account category tab on scope switch)

**Modal Scope Toggle (記帳歸屬二態切換)**:
在快速記帳、新增交易、信用卡還款、週期收支設定等表單彈窗（Modal）中，收支歸屬固定簡化正名為搭配 `Home` 圖示之「公帳」與搭配 `Lock` 圖示之「私帳」二元切換按鈕，移除多餘之「(公開)」、「(隱私)」等括號贅詞。
_Avoid_: 家庭公帳 (公開) (verbose public)、個人私帳 (隱私) (verbose private)

**Household Scope Advance Visibility (公帳視角代墊透視)**:
在帳戶管理之「公帳」視角下，系統除呈現家庭共同基金與共同信用卡（is_joint = 1）外，同時納入「含有家庭代墊公帳欠款（shared_debt > 0）之個人信用卡」以及「家庭公帳代墊待沖款總覽橫幅（Pending Household Advances Banner）」，讓全家成員清楚掌握家庭實質應負擔之所有公帳資產與代墊負債。
_Avoid_: 私卡完全遮蔽 (full private card block)、漏列公帳代墊 (omitted advances)

**Sanitized Private Card Shared View (私卡公帳脫敏檢視)**:
當家庭成員在公帳視角檢視非本人之代墊個人信用卡時，系統執行嚴格資訊脫敏（Data Masking），僅揭示卡片名稱、持卡人姓名、家庭代墊公帳待繳額（shared_debt）與結帳/繳款日，徹底遮蔽持卡人之個人信用額度（credit_limit）與個人私帳消費額（personal_debt）。非持卡人僅開放點擊「繳家庭代墊」協助自共同基金清償公帳欠款，禁止執行校準、出帳作業、修改或刪除。
_Avoid_: 完整私卡暴露 (unmasked private card)、越權出帳 (unauthorized rollover)

**Accrual Household Balance (公帳權責淨餘額)**:
公帳視角下的「信用卡總待繳」與「淨可用餘額」採權責會計責任制，將「家庭共同信用卡欠款」與「全體成員個人私卡上之公帳代墊欠款（shared_debt）」合併計入家庭負債，真實反映扣除所有公帳待付責任後的家庭淨可用資金。
_Avoid_: 虛胖可用餘額 (inflated available balance)、純共同帳戶窄視角 (narrow joint-only balance)

**Mobile Account Card Overflow Guard (手機帳戶卡片防溢出)**:
手機版儀表板「帳戶一覽」卡片採兩行標題（第一行 SVG 圖示＋帳戶名稱，過長以省略號截斷；第二行公私帳與類型徽章）、信用卡「代墊」與「個人私帳」金額分行靠右，且網格欄位使用 `minmax(0, 1fr)` 與 `min-width: 0`，確保卡片絕不超出螢幕寬度。
_Avoid_: 單列硬擠 (single-row cramming)、橫向截斷 (horizontal clipping)

---

### 家庭代墊與報銷核銷生命週期 (Household Advances & Reimbursement Lifecycle)

**Itemized Advance Reconciliation (明細實報實銷制)**:
成員以個人私帳／私卡／現金墊付公帳（`is_shared = 1` 且 `is_joint = 0`）之消費與退款，其待報銷總額（`pending_reimburse`）嚴格等於「目前待報銷清單中所有未報銷項目之淨金額加總（$$\sum \text{代墊支出} - \sum \text{代墊退款}$$）」。每一筆結清款項皆精確綁定特定收支明細之 `reimbursement_id`，讀取查詢端點（`GET /households/advances`）全面落實純讀取冪等性，嚴禁在查詢時執行任何靜默修改資料庫之「歷史差額自動沖銷（auto-heal）」副作用。
_Avoid_: 讀取端點自動核銷副作用 (side-effect auto-healing on GET requests)、貪婪猜測核銷 (greedy fallback auto-linking)、硬湊不相等的公式算式 (mathematically contradictory tooltip formulas)

**Shared Refund Offset in Advances (公帳退款／刷退負項抵減)**:
成員以個人帳戶、私卡或現金代墊公帳後所發生之退貨、刷退或回饋金（`type = 'income'`, `is_shared = 1`, `account.is_joint = 0`，且非內部移轉如信用卡還款、內部轉帳、公帳代墊報銷），納入家庭代墊清單中作為負項（顯示為綠色減項），自動抵減該成員之待報銷總額，確保代墊款不因刷退退貨而虛增。
_Avoid_: 排除退款導致代墊虛增 (omitting shared refunds leading to inflated advances)

**Explicit Reimbursement Surplus Display (預收款／溢撥款獨立揭示)**:
當家庭歷史自共同基金撥款報銷之總金額大於已具體勾稽結清之代墊明細總額時（例如整數定額撥款或手動預支），系統將此差額獨立清晰標示為「家庭基金溢撥／預收款：NT$ X」，絕不可自動侵吞後續新增的未報銷代墊消費。
_Avoid_: 差額靜默吞食新代墊 (silent swallowing of new advances by surplus difference)

**Dual Tab Advance Audit & Unlink Action (待報銷與已結清雙分頁與解除報銷)**:
在家庭協同（Family）代墊明細區塊提供「待報銷明細（Pending）」與「已結清明細（Settled）」分頁切換，完整追溯每一筆已報銷代墊由哪一筆撥款流水結清；並支援家庭管理員或記錄者本人執行「解除報銷（退回待報銷）」，將誤核銷之收支明細重置為未報銷狀態（`reimbursement_id = NULL`），具備完整防呆與審計溯源性。
_Avoid_: 已結清明細黑盒子不可見 (invisible settled advances black-box)、誤核銷無法退回 (irreversible accidental reimbursement)

**Historical Auto-Heal Reset (歷史自動核銷標記平反重置)**:
系統執行單次冪等資料庫修正，將過去因歷史差額自動沖銷邏輯被打上 `reimbursement_id = 'historical_reimbursement'` 標記之歷史收支全面重置為 `NULL`，使被誤吞隱藏之代墊明細立即全數重見天日並回到待報銷清單中供使用者核對與勾選。
_Avoid_: 歷史誤吞資料永久遺失 (leaving historical auto-healed items permanently hidden)

---

### 交易分類體系 (Category Taxonomy)

**Curated Category Taxonomy (標準擴充分類庫)**:
系統內建定義之標準收支分類集合，覆蓋日常生活高頻場景，具備標準 Lucide 向量 SVG 圖示（`CategoryIcon`）、語意推薦關鍵字庫與統計圖表適配，不開放建立零碎自訂資料表以確保家庭成員在統計、預算與圓餅圖上擁有統一的分析維度。
_Avoid_: 自訂分類表 (custom category table)、動態標籤 (dynamic tags)、未分類 (unclassified)、Emoji 分類圖示 (emoji category icons)

**Standard Category Set (標準分類清單)**:
系統內建定義之標準收支分類與專屬向量圖示集合，包含 16 項支出（餐飲 `Utensils`、交通 `TrainFront`、汽機車輛 `Car`、居家水電 `Zap`、數位訂閱 `Smartphone`、購物 `ShoppingBag`、生活 `Lightbulb`、娛樂 `Gamepad2`、美妝保養 `Sparkles`、醫療 `Pill`、教育 `BookOpen`、寵物毛孩 `PawPrint`、旅行度假 `Plane`、社交人情 `HeartHandshake`、保險稅費 `ShieldCheck`、其他 `Package`）、8 項收入（薪資 `Banknote`、獎金 `Gift`、投資 `TrendingUp`、兼職 `Briefcase`、政府補貼 `Landmark`、禮金餽贈 `Heart`、二手出清 `Recycle`、其他 `Package`）與 4 項系統類別（信用卡還款 `CreditCard`、內部轉帳 `ArrowLeftRight`、ATM提款 `Coins`、公帳代墊報銷 `HandCoins`）。
_Avoid_: 自由輸入類別 (freeform category)、舊版八大類 (legacy 8 categories)、Emoji 字串映射 (emoji string mapping)

**Two-Tier Category Recommendation (雙層分類推薦引擎)**:
在使用者輸入交易備註或通訊軟體自然語句時，自動推測最合適分類的雙層架構：第一層優先檢索個人/家庭近期歷史交易備註（Historical Note Memory），以 `note != '' AND (note = ? OR instr(?, note) > 0)` 檢索非空歷史備註（嚴禁將資料庫 `note` 置於 `LIKE '%' || note || '%'` 樣板端，以免長備註觸發 SQLite `LIKE or GLOB pattern too complex` 上限崩潰或空字串萬用誤配），若有歷史同名或包含紀錄則優先採納個人既有習慣；第二層若無歷史紀錄，則落入內建生活語意關鍵字庫（Lexicon Fallback，涵蓋高頻品牌、交通、水電、訂閱、寵物等名詞）進行精準匹配。
_Avoid_: 純關鍵字暴力匹配 (hardcoded keyword matching only)、全盲隨機猜測 (blind guess)、欄位拼接 LIKE 樣板 (`LIKE '%' || note || '%'`)

**Adaptive Category Preselection (自適應分類預選與鎖定保護)**:
前端記帳表單在使用者鍵入交易備註或商家名稱時，即時調用雙層分類推薦引擎自動切換分類下拉選單並顯示搭配 `Sparkles` 向量圖示之「已智慧推薦為【類別】」柔和微光徽章。若使用者在該次填表中主動手動點選更換過分類，系統即刻啟動「選擇鎖定 (User Choice Lock)」，後續打字將嚴格保留使用者手動設定，杜絕反覆覆蓋干擾。
_Avoid_: 強迫覆蓋 (forced overwrite)、生硬彈窗 (intrusive popup)、無感靜默 (silent shift)

### 規劃與預測 (Planning & Forecasting)

**Recurring Item (週期收支)**:
按規律頻率（週、月、雙月、季、半年、年）固定重複發生的週期性收入或支出。
_Avoid_: 訂閱 (subscription)、固定支出 (fixed expense)、週期契約 (contract)

**Recurring Ledger Attribution (週期收支公私帳歸屬)**:
每筆週期收支具備顯式之公私帳歸屬標記（`is_shared`：搭配 `Home` 圖示之公帳 / 搭配 `Lock` 圖示之私帳）。於表單選取扣款帳戶時自動預帶該帳戶之公私屬性，並允許手動切換以支援「以個人私卡固定代扣家庭公帳（如水電、網路費）」之代墊情境。私帳週期項目僅建立者本人可見與改刪；公帳週期項目對全體家庭成員透明共享，並由建立者與家庭管理員共治管理。
_Avoid_: 純依賴帳戶歸屬 (account-only inference)、無公私帳區分之固定收支 (unscoped recurring item)

**Exact Recurring Schedule (確切週期繳費排程)**:
週期收支必須精確綁定執行頻率與對應時點：
- **週繳 (`weekly`)**：以 `day_of_cycle` 記錄星期幾（`1` = 週一、`2` = 週二、`3` = 週三、`4` = 週四、`5` = 週五、`6` = 週六、`7` = 週日），`month_of_cycle` 固定為 `1`。表單由其他週期切換至「每週」時，若原 `day_of_cycle > 7` 或 `< 1`，自動夾限重置為 `1`（週一）；卡片顯示為 `每週一扣款`（或 `每週一入帳`），右側頻率標示為 `每週繳` / `每週收`。
- **月繳 (`monthly`)**：每月指定日期（1~31 號）。
- **雙月繳 (`bimonthly`)**：單數月 (`month_of_cycle = 1`) 或雙數月 (`month_of_cycle = 2`) 之指定日期。
- **季繳 (`quarterly`)**：起算月 1/2/3 每季循環之指定日期。
- **半年繳 (`semiannual`)**：起算月 1~6 每半年循環之指定日期。
- **年繳 (`annual`)**：指定 1~12 月份與日期。
在現金流預測中，月／雙月／季／半年／年繳遇大小月或二月天數不足時，一律自動平貼（clamp）至該月份最後一日完成扣款與模擬；週繳項目則於未來 365 天內精確對應每一個符合該星期幾（`day_of_cycle` 1~7）之日期觸發排程，嚴禁粗暴以月份倍數模除或跨月推遲。
_Avoid_: 模除猜測 (modulo guessing)、固定雙數月 (hardcoded even months)、跨月遞延 (month overflow drift)、週繳未指定星期幾或直接顯示「每週 1 號」(ambiguous weekly schedule or raw number label for weekday)

**Amortization & Recurring Sinking Fund Reserve (週期支出每月平均、已繳扣除與一年內週期準備金池，ADR-0047)**:
將不同週期之收支轉化為每月標準額度資金負擔（或預估收入），並結合「雙軌已繳判定」計算**當月尚需預留之週期支出（`remainingMonthlyFixed`）**與**一年內週期準備金池（Recurring Sinking Fund Reserve）**，不混入一般夢想「儲蓄目標 (`Goals`)」：
1. **各週期每月平均除數（`CYCLE_MONTHS` / `CYCLE_DIVISORS`）**：
   - **每週 (`weekly`)**：除數 `0.25`（即 `每週金額 × 4`，以每月 4 週直觀估算）
   - **每月 (`monthly`)**：除數 `1`
   - **每雙月 (`bimonthly`)**：除數 `2`
   - **每季 (`quarterly`)**：除數 `3`
   - **每半年 (`semiannual`)**：除數 `6`
   - **每年 (`annual`)**：除數 `12`
   凡非「每月 (`cycle !== 'monthly'`)」之週期項目（包含每週、雙月、季、半年、年），於週期收支卡片副標題皆顯示 `換算每月平均：$X / 月`。
2. **雙軌自動聯動「已發生／已繳」判定（Dual-Track Settled Detection）**：
   - **軌道一（實際收支明細自動比對）**：於該項目當前週期區間內（`monthly`/`weekly` 為當月 `YYYY-MM-01 ~ YYYY-MM-31`；長週期 `bimonthly`/`quarterly`/`semiannual`/`annual` 為最近一次應扣款月份至當月之該期區間），若 `transactions` 中存在同收支類型（`type`）、同公私帳歸屬（`is_shared`）且備註（`note`）包含或等於該週期項目名稱（不分大小寫）之收支紀錄，系統自動認定該期已發生／已繳（`settled_source = 'transaction'`；對 `weekly` 項目則統計當月實際已發生筆數或已繳金額，上限為當月應付額）。
   - **軌道二（手動勾選「已繳」雙向同步）**：與 `forecast_settled_events`（`event_key` 為 `recurring:${id}:${YYYY-MM-DD}` 或 `recurring:${id}:${YYYY-MM}`）雙向互通。使用者可在「週期收支 (`Recurring.tsx`)」卡片上直接一鍵切換「本期已繳 / 標記已繳」，亦可在「現金流預測 (`Forecast.tsx`)」勾選已繳，兩端狀態即時同步（`settled_source = 'manual'`）。
3. **精準當月待預留額（`remainingMonthlyFixed`）與防雙扣機制**：
   - **當月應付短週期（`weekly` / `monthly`）與當月剛好到期之長週期項目**：若本期已繳，則當月待預留額為 `$0`（因款項已從銀行／現金扣除或計入信用卡欠款，不再重複雙扣）；若尚未繳（或 `weekly` 僅部分週次已繳），則預留當月尚未繳納之剩餘金額。
   - **當月未到期、但在未來一年內會到期之長週期項目（`bimonthly` / `quarterly` / `semiannual` / `annual`）**：若該期尚未提前繳納，則於當月繼續預留其「每月平均攤提額（`amount / cycleMonths`）」，確保當月應提撥之準備金不被花掉；若該期已提前繳清，則當月攤提預留為 `$0`。
   - 「真實可支配現金 (`Disposable Cash`)」改以 `remainingMonthlyFixed`（而非死板的靜態 `monthlyFixed` 總額）進行扣減。
4. **一年內週期準備金池、預留金帳戶比對與不足額往後平攤追補（1-Year Recurring Sinking Fund & Shortfall Catch-up Amortization，ADR-0047、ADR-0048）**：
   - **一年內週期支出年度總額（`annual_total_expense`）**：`∑ (各筆週期支出之每月平均 × 12)`。
   - **本週期／今年已繳納總額（`annual_settled_expense`）**與**一年內尚待支付總額（`annual_remaining_expense`）**：統計各週期項目於當前年度／當前週期內已實際繳納之金額與未來一年內尚待支付之剩餘總額。
   - **長週期累計應留存準備金水位（`accumulated_sinking_fund`）與前期應有水位（`prior_accumulated_sinking_fund`）**：針對雙月、季、半年、年繳等跨月長週期支出（`cycleM >= 2`），若本期未繳：
     - 截至上月底已走過之攤提月數为 $p_i = k_i - 1 \in [0, M_i - 1]$（其中 $k_i \in [1, M_i]$ 為截至本月底之累積月數），距離下次繳款日（含本月）尚餘之存錢月數為 $r_i = M_i - p_i = M_i - k_i + 1 \in [1, M_i]$。
     - 截至上月底理論上應已留存於預留金帳戶之準備金為 $E_i = p_i \times m_i$（全體合計 $E_{\text{prior}} = \sum E_i$），截至本月底應達標之準備金為 $k_i \times m_i$（全體合計 $E_{\text{curr}} = \sum k_i \times m_i$）。
   - **預留金帳戶實際總額（`actual_reserve_balance`）比對與不足額往後平攤（Shortfall Catch-up across Remaining Months）**：
     - 系統加總當前視角下所有預留金帳戶（`is_reserve = 1`）之實際餘額 $R_{\text{actual}}$。
     - 若預留金不足（$R_{\text{actual}} < E_{\text{prior}}$，總前期缺口 $S_{\text{total}} = \max(0, E_{\text{prior}} - R_{\text{actual}})$）：
       系統按各筆長週期項目之應有準備金比例（$w_i = E_i / E_{\text{prior}}$）分配現有預留金與前期缺口 $S_i = S_{\text{total}} \times w_i$，並將該筆缺口 $S_i$ **往後平攤至該筆項目下次繳款之前的剩餘月份 $r_i$（含本月）**：
       $$\text{catchupMonthlyAdd}_i = \frac{S_i}{r_i}, \quad \text{effectiveMonthlyShare}_i = m_i + \frac{S_i}{r_i} = \frac{A_i - R_i}{r_i}$$
       （其中 $R_i = E_i - S_i$ 為該項目分配到之現有預留金，確保在下次繳款前的 $r_i$ 個月內每月按 $\text{effectiveMonthlyShare}_i$ 提撥，到期時 100% 湊滿應繳全額 $A_i$！）
     - 當月尚需預留之週期支出總額（`remainingMonthlyFixed` / `remaining_monthly_expense`）即採用含不足額往後平攤後之有效應預留額（扣除當月已繳），於「週期收支 (`Recurring.tsx`)」與「總覽頁 (`Dashboard.tsx`)」清晰揭示原本每月平攤、前期預留不足追補平攤額，以及調整後本月應預留金額。
_Avoid_: 分攤平滑 (amortization smoothing)、分期 (installment)、平滑化 (smoothing)、攤提 (proration)、每週項目直接除以 1 當成月繳或產生非整數倍碎數 (treating weekly as monthly divisor 1 or awkward fractional multipliers)、當月已繳納房租或帳單後仍從真實可支配現金重複扣除完整每月平均 (double-deducting already-paid recurring items from disposable cash)、將必付週期帳單準備金混入一般夢想儲蓄目標達成率 (polluting savings goals progress with mandatory recurring bill reserves)、預留金帳戶餘額不足時仍死板維持原每月平均導致到期日錢不夠付 (ignoring reserve shortfall and failing to spread deficit across remaining months before due date)

**Scoped Cash Flow Forecast (三態現金流預測)**:
支援切換「全部 (`all`)」、「公帳 (`household`)」、「私帳 (`personal`)」之未來 12 個月（365 天）逐日資金流模擬引擎（含雙月、季、半年、年繳等長週期項目完整排程模擬）。各視角之第 0 天起始基準餘額為該視角下之「現金錢包總額 ＋ 銀行存款總額」實際正資產餘額（未設定繳款日之信用卡欠款除外），並將信用卡欠款依結帳週期拆分為「已出帳待繳款（排入最近一次繳款日）」與「未出帳款（排入下一次結帳日出帳後之繳款日）」分別排入 12 個月時間軸扣減（避免於第 0 天重複預扣或跨期混同），依視角過濾未來 12 個月預定發生之週期收支與繳卡費排程事件，於時間軸卡片標示 `Home` 公帳 / `Lock` 私帳向量徽章、扣款帳戶，以及**該筆事件執行後之逐筆累計結餘（`running_balance`，同日多筆事件依收入優先於支出之順序逐筆加減反映水位變化；若結餘 `< $0` 則以醒目珊瑚紅標示透支）**。
_Avoid_: 單一混合預測 (unscoped mixed forecast)、第 0 天重複預扣未出帳卡費 (day-0 double deduction of unbilled debt)、將未出帳與已出帳混綁於同一期繳款日 (lumping unbilled debt into current billed due date)、時間軸卡片僅顯示收支金額卻看不出當下剩餘水位 (omitting running balance after each scheduled event)

**Forecast Date Range Filter (預測日期區間查詢)**:
於未來 12 個月（365 天）現金流預測結果之上，提供「起始日期 (`startDate`) ~ 結束日期 (`endDate`)」區間查詢篩選器（預設為今日起算完整 12 個月，並提供「近 60 天」、「近 6 個月」、「完整 12 個月」三顆快捷區間按鈕）。
- **電腦版與平板端**：日期輸入框（`input[type="date"]`）具備充足最小寬度（`min-width: 150px`），確保 `YYYY-MM-DD` 與原生月曆圖示完整呈現不截斷。
- **行動端（`<= 640px`）三層滿寬響應式結構**：篩選器卡片轉為 100% 滿寬三層佈局——第一層為「查詢區間」標題列；第二層為起始與結束日期選擇器（滿寬彈性雙欄或單欄展開、字級 `16px` 防止 iOS 自動縮放且完整顯示年月日）；第三層將「近 60 天 / 近 6 個月 / 完整 12 個月」轉為三欄等寬網格按鈕（`grid-template-columns: repeat(3, minmax(0, 1fr))`）。
調整起訖日期區間時，同步連動篩選並即時重算：
1. **上方三張指標卡**：該區間內之資金安全評級（依區間最低餘額點判定 `SAFE` / `WARNING` / `DANGER`，存在透支時副標題顯示「共 N 段透支（合計 M 天）」）、該區間最低餘額點與發生日期、該區間預定事件數。
2. **透支風險區間警示卡 (`Overdraft Interval`)**：列出負數餘額之所有連續時間區間並支援點擊快速聚焦。
3. **現金流水位趨勢圖 (`AreaChart`)**：僅繪製所選起訖日期區間內之逐日餘額走勢，並支援跨年度日期標記（`YYYY-MM-DD`）。
4. **收支排程清單**：僅顯示落於所選起訖日期區間內之預定收支與繳卡費事件，且每張卡片同步呈現該筆事件發生時之真實累計結餘（`running_balance`）。
_Avoid_: 僅過濾清單而指標卡與圖表不連動 (decoupled filter state)、日期輸入框寬度過窄導致年份或月曆圖示被裁切 (clipped date input width)、手機版將標題、雙日期框與三個快捷鈕硬塞同一行導致鋸齒狀斷行 (cramming label, two date pickers, and three preset pills into a single jagged flex row on mobile)

**Overdraft Interval (透支風險區間 / 負數餘額區間)**:
在現金流預測模擬中，將逐日預估餘額小於零（`balance < 0`）之連續日期自動聚合為獨立的「透支風險區間」（若單日為負則顯示 `YYYY-MM-DD（共 1 天）`，連續多日則顯示 `startDate ~ endDate（共 N 天）`）。
- **單筆透支區間資訊**：
  1. **起訖日期與持續天數**：`startDate ~ endDate · 共 N 天`（單日則標示 `startDate · 共 1 天`）。
  2. **區間最低餘額（最大資金缺口）與發生日**：該段連續負值期間內之最低點金額 `minBalance` 與發生日期 `minDate`。
  3. **首日觸發透支之關鍵支出事件摘要**：列出該區間首日（`startDate`）發生且未勾選已繳之支出／繳卡費事件名稱（若第 0 天起始即為負數則標示「起始可用餘額不足」）。
- **版面呈現與點擊聚焦互動**：
  - 當存在透支區間時，於上方三張安全指標卡正下方（折線圖上方）顯示醒目之「透支風險區間警示卡」（若全區間皆 `>= $0` 則自動隱藏）；第一張「資金安全評級」指標卡副標題同步顯示「共 N 段透支（合計 M 天），請及早調度資金」。
  - 支援點擊任一透支區間（或「聚焦此區間」按鈕）快速將查詢區間（`startDate ~ endDate`）鎖定至該透支區間（若聚焦中則高亮標示當前選中之區間，並於卡片右上角提供「還原完整 12 個月」按鈕方便隨時切換或返回全景）。
_Avoid_: 僅顯示全期單一最低點而掩蓋多段分佈之透支時期 (showing only a single global minimum date while hiding multiple separate overdraft periods)、未合併連續負數日期導致 300 行重複單日洗版 (flooding UI with unmerged daily negative rows)、無負數時仍佔用版面顯示空警示框 (rendering empty warning box when cash flow is safe)

**Card Payment Event (繳卡費事件)**:
現金流預測 12 個月（365 天）時間軸上，依信用卡帳務狀態拆分為兩類獨立扣繳支出事件：
1. **已出帳繳卡費（`繳卡費 · 卡名（已出帳）`）**：金額為該卡歸屬當前視角之已出帳待繳款 (`balance > 0`)。系統先依據該卡之最近一期已出帳結帳日（`cutoffStatementDate`，若未設結帳日則依當月繳款日）推算其對應之「原訂扣款日（`originalDueDate`）」：
   - 若 `originalDueDate >= 今日（D0）`：排入該 `originalDueDate` 扣款。
   - **已過扣款日未扣款之即刻歸屬（`originalDueDate < 今日 D0`）**：當已過原訂扣款日但帳上仍有未結清之已出帳餘額時，強制歸入**今日（預測起始日 `D0`）**立即扣除，事件名稱標示為 `繳卡費 · 卡名（已出帳 · 原訂 MM/DD 扣款）`，且 `event_key` 維持綁定 `originalDueDate`（`card_due:${card.id}:${originalDueDate}`）以確保跨日不重置「已繳」勾選狀態。
2. **未出帳繳卡費（`繳卡費 · 卡名（未出帳）`）**：金額為該卡歸屬當前視角之未出帳款 (`unbilled > 0`)，依該卡結帳日（Statement Day）與實際出帳狀態推算所屬結帳日：
   - 僅當「今日已過本月結帳日 **且**（本月已執行過手動出帳作業 `last_rollover_at >= 本月結帳日` 或目前已有已出帳餘額 `rawBilled > 0`）」時，未出帳才歸屬於下月結帳日；若已過本月結帳日但尚未執行「出帳作業」且 `rawBilled === 0`，則未出帳優先對應「本月結帳日」之扣款日（若連該扣款日也已過期 `< 今日 D0`，同樣歸入今日 `D0` 立即扣除並標示 `原訂 MM/DD 扣款`）。
   - 當已出帳款因過期而歸入今日（`D0`）時，當期未出帳維持排入下一個正常結帳週期之扣款日，**絕不連帶往後多順延一個月**。
3. **已報銷沖帳公帳消費之待繳歸屬轉移**：個人私卡上之公帳消費（`is_shared = 1`）若已於家庭協同完成「報銷沖帳」或「標記已額外處理」（`reimbursement_id` 非空），其尚未繳給銀行的待扣款金額不再計入「公帳」視角之繳卡費事件，而是歸入持卡人「私帳」視角之繳卡費事件中扣款。
兩筆事件於時間軸上各自獨立顯示，並支援分別勾選「已繳」豁免。
_Avoid_: 自動繳卡 (auto repayment)、漏計未出帳金額 (omitting unbilled debt in schedule)、已過扣款日未扣款卻順延至下個月造成當月可用資金虛高 (deferring overdue billed debt to next month inflating current available cash)、因已出帳逾期或未按出帳作業而將未出帳連帶往後多推遲一個月 (cascading 1-month delay on unbilled due date)、已出帳與未出帳強行合併同日扣繳 (forcing billed and unbilled onto the same due date)、已於家庭協同報銷沖帳之卡費仍在公帳現金流重複扣款 (double-deducting reimbursed card advances in household forecast)

**Credit Card Recurring Cash Flow Shift (信用卡週期收支繳款日平移)**:
在未來 12 個月（365 天）現金流預測中，凡設定由信用卡扣款之週期收支項目，其真實現金資產流出日不再發生於刷卡記帳日（day_of_cycle），而是依據該信用卡之結帳日與繳款日精準平移至對應之「信用卡繳款日（Payment Due Day）」，時間軸保留週期項目獨立卡片並標記卡片與繳款日扣款，真實反映流動性到期責任並支援「已繳」單筆豁免。針對「每週 (`weekly`)」且綁定信用卡之週期項目，因同一結帳週期內的 4~5 次每週刷卡皆會平移至同一個信用卡繳款日，為避免 `event_key` 碰撞覆蓋並維持逐筆獨立勾選「已繳」，其 `event_key` 附加原刷卡日區隔（格式：`recurring:${item.id}:${due.dateStr}:${chargeDateStr}`），且事件名稱標註原刷卡日期（格式：`${item.name} (${MM/DD} 刷 · ${account_name} 信用卡繳款日扣款)`）。
_Avoid_: 刷卡日直接扣款 (immediate swipe cash deduction)、粗暴合併繳卡費 (opaque card merge)、同一帳期內多筆每週信用卡項目因相同繳款日導致 event_key 碰撞無法獨立勾選已繳 (event_key collision for multiple weekly credit card charges landing on the same due date)

**Settled Forecast Event (已繳預測事件)**:
未來 12 個月（365 天）現金流預測排程中，已被使用者勾選標記為「已繳」（搭配 `CheckCircle2` / `Circle` 向量圖示）之單次排程事件（涵蓋週期支出、週期收入與已出帳／未出帳繳卡費，以 `項目 ID + 預計日期 YYYY-MM-DD` 唯一識別）。當一筆事件已經實際刷卡入帳（進入信用卡未出帳）或已提前消費扣款時，勾選「已繳」即可將該次事件從 12 個月現金流折線圖與購買力試算中豁免（不列入計算，防止重複扣款），並在排程清單中保留顯示為半透明刪除線狀態，同時標示當下維持不變之預估結餘（`running_balance`），支援隨時取消勾選恢復計算。
_Avoid_: 刪除排程 (delete schedule)、永久停用 (permanent disable)

**Savings Goal (儲蓄目標)**:
使用者設定具有目標總額與預計達成日的專項資產目標，其每月提撥額實質鎖定可支配現金。目標圖示採用 12 款預設 Lucide 向量 SVG 圖示選擇器（將圖示代號存入 `emoji` 欄位，並對既有資料庫中舊有 Emoji 字串自動向後相容轉譯為對應 SVG 圖示）。
_Avoid_: 存錢筒 (piggy bank)、夢想基金 (fund target)、願望 (wish)、直接渲染生文字 Emoji (raw emoji rendering)

**Budget & Scoped Persistent Budget System (預算額度與三態常駐預算體系，ADR-0046)**:
針對日常消費類別（16 項標準支出分類）及全月總支出（`category = '__TOTAL__'`）所設定之月度支出上限與即時預警把關機制，具備以下五大核心特性：
1. **每月常駐預設與單月特定覆寫（Persistent Default & Month-Specific Override）**：
   - 預算預設儲存為「每月常駐預設（`month = 'default'`）」，設定一次即自動跨月沿用至所有月份，免除每個月初重新設定的繁瑣操作。
   - 同時相容單月特定覆寫（`month = 'YYYY-MM'`）：查詢指定月份之預算時，針對同一分類與公私帳歸屬，優先取用該月份（`YYYY-MM`）之設定，若無則自動回退套用常駐預設（`default`）。
   - 支援隨時刪除／清除已設定之預算（`DELETE /budgets/:id` 或於預算設定彈窗點擊「清除此項預算」）。
2. **公私帳兩層分離與三態視角聚合（Household / Personal Two-Layer Attribution & All-Scope Aggregation）**：
   - 預算區分為「家庭公帳預算（`is_shared = 1`）」與「個人私帳預算（`is_shared = 0`）」兩層獨立儲存。
   - **權限邊界**：個人私帳預算（`is_shared = 0`）僅限本人檢視、設定與刪除；家庭公帳預算（`is_shared = 1`）由家庭全體成員共享檢視並協作共管（任一家庭成員皆可新增、調整或清除家庭公帳預算）。
   - **三態視角（`all` / `household` / `personal`）對應規則**：
     - 在「公帳 (`household`)」視角下：僅檢視與比對家庭公帳預算（`is_shared = 1`）及家庭公帳日常消費支出。
     - 在「私帳 (`personal`)」視角下：僅檢視與比對本人之個人私帳預算（`is_shared = 0`）及個人私帳日常消費支出。
     - 在「全部 (`all`)」視角下：將同一分類之「家庭公帳預算 ＋ 個人私帳預算」自動相加作為該分類之總預算額度，並與「公帳＋本人私帳」之該分類總消費比對；點擊設定預算時，彈窗內提供「私帳 / 公帳」二態歸屬切換器供明確指定要設定哪一層預算。
3. **智慧每月總預算上限（Smart Monthly Total Budget）**：
   - 支援透過虛擬分類 `category = '__TOTAL__'` 獨立設定「每月總預算（手動總預算，`manualTotalBudget`）」。
   - 當前視角之**每月有效總預算（`effectiveTotalBudget`）**自動取 `max(手動設定之總預算, ∑ 已設定之各分類預算總和)`，確保即使使用者僅設定個別分類預算、或分類預算加總超過原先手動設定之總預算時，總預算把關額度依然合理自洽。
   - **日常消費統計邊界**：計算分類預算與每月總預算之「已花費金額 (`spent`)」時，嚴格排除 4 項系統內部移轉類別（`信用卡還款`、`內部轉帳`、`ATM提款`、`公帳代墊報銷`），與統計分析消費分類圓餅圖 100% 對齊。
   - **三段式進度狀態與警示**：已花費佔比 `< 80%` 為安全翠綠（`safe`）、`80% ~ 100%` 為接近上限琥珀黃警戒（`warning` / `80%+`）、`> 100%` 為超支危險珊瑚紅（`over`，醒目標示超支金額）。
4. **「預算管理 (`Budgets.tsx` / `/budgets`)」獨立頁面與總覽頁 (`Dashboard.tsx`) 雙端把關架構**：
   - **職責完全抽離（Separation of Concerns）**：將預算設定與把關由「統計與分析 (`Analytics.tsx` / `/analytics`)」完全抽離為獨立一級頁面「預算管理 (`/budgets`，搭配 `Sliders` 圖示，於左側主選單排列於「週期收支」與「儲蓄目標」之間）」；「統計與分析」頁專注於家庭公帳墊付分攤統計、支出分類圓餅圖與年度收支趨勢長條圖。
   - **「預算管理 (`Budgets.tsx`)」完整預算中心版面**：
     1. **頂部標題與操作列**：支援月份切換（`input[type="month"]`）、「設定每月總預算」按鈕、「設定分類預算」主按鈕，以及下方 `ScopeTabBar` 三態視角切換器（全部 / 公帳 / 私帳）與 1:1 對齊之 `BudgetsSkeleton` 骨架屏。
     2. **三大核心預算統計卡片（`.stat-card` + `FormulaTooltip`）**：
        - **每月有效總預算**：顯示 `effectiveTotalBudget`（標註依手動總預算上限或依分類預算加總）。
        - **當月日常消費已花**：顯示 `totalSpent` 及佔有效總預算之使用率百分比。
        - **本月剩餘可花費（或已超支金額）**：顯示 `remainingBudget`（當超支時以珊瑚紅顯示超支差額，未超支時註明已預留於真實可支配現金）。
     3. **每月總預算進度總覽大卡**：呈現醒目的三段式總進度條（`< 80%` 安全翠綠、`80% ~ 100%` 警戒琥珀黃、`> 100%` 超支珊瑚紅）、公私帳總預算拆解與快捷調整入口。
     4. **四態分類預算篩選頁籤（Category Budget Filter Tabs）**：提供 `全部分類 (16)`、`已設預算 (N)`、`超支 / 警戒 (N)`（已設預算且 `spent / amount >= 0.8`）、`未設預算 (N)` 四顆篩選頁籤（行動端 `<= 640px` 自動轉為 `2x2` 雙欄等寬網格），搭配下方分類預算進度卡片清單與常駐預算設定／清除彈窗。
   - **總覽頁 (`Dashboard.tsx`) 摘要卡片連動**：右側資訊欄之「本月預算把關」摘要卡片呈現當前視角之每月有效總預算進度與前 3~4 項重點分類預算進度，其「設定」與「前往設定每月預算」連結全面指向 `/budgets`。
5. **真實可支配現金預留與現金流預測「納入預算預扣」開關（Disposable Cash Reserve & Forecast Budget Toggle）**：
   - **真實可支配現金 (`Disposable Cash`)**：`GET /accounts/balance` 回傳當前視角之 `monthlyBudget`（每月有效總預算）、`monthSpent`（當月已花費日常消費）與 `remainingBudget`（`max(0, monthlyBudget - monthSpent)`，當月剩餘未用預算預留），並將 `disposable` 更新為 `available - monthlyFixed - monthlyGoals - remainingBudget`（因 `monthSpent` 已實質反映於帳戶餘額減少或信用卡欠款增加，僅預扣尚未花掉之 `remainingBudget` 以防重複雙扣）。
   - **現金流預測 (`Forecast`) 可選預扣開關**：`GET /forecast` 與 `POST /forecast/purchase-check` 支援查詢參數／欄位 `include_budget = 1`（前端預測頁提供「納入預算預扣」切換開關，預設關閉以避免未預期的全年透支警報）。當開啟時：
     - **當月月底（或若今日即月底則為今日）**：若當月剩餘未用預算 `remainingBudget > 0`，排入一筆 `每月預算剩餘預留（YYYY-MM）` 支出事件（金額 `= remainingBudget`）。
     - **未來各月月底（預測期內後續各月份之最後一日）**：依據常駐預設（及該未來月份若有之特定覆寫）計算該月有效總預算 `futureEffectiveTotalBudget`，若 `> 0` 則於該月最後一日排入一筆 `每月預算預留（YYYY-MM）` 支出事件，讓使用者一鍵模擬「若每個月都把預算花滿」時未來 12 個月的資金水位與購買力安全性。
_Avoid_: 額度 (spending limit)、花費上限 (cap)、配額 (allowance)、每個月初被迫重新手動輸入相同預算 (forcing manual re-entry of recurring monthly budgets every month)、預算不分公私帳導致切換公帳或私帳視角時預算與支出兜不攏 (unscoped budgets mismatching scoped expense views)、設定後無法刪除或歸零預算 (inability to delete or clear a configured budget)、將信用卡還款或內部轉帳計入預算已花費 (counting credit card repayments or internal transfers toward budget spending)、將完整月總預算與當月已發生消費重複雙扣 (double-counting full monthly budget on top of already-spent transactions)

**Affordability Check (購買力試算)**:
使用者面臨大額消費前，隨當前所選視角（全部 / 公帳 / 私帳）即時試算扣除該筆開銷並模擬未來 12 個月（365 天）該視角週期收支與各期繳卡費後，是否會發生透支或擠壓儲蓄目標預留款的安全檢查。在「公帳」視角下，專注檢核共同基金是否透支，嚴格隔離成員個人私密儲蓄目標。
_Avoid_: 購買模擬 (purchase simulation)、預算檢查 (budget check)、試算 (simulation)


---

### 機器人整合 (Bot Integration)

**Bot Binding (機器人綁定)**:
通訊軟體帳號（LINE 或 Telegram）與記帳使用者帳號透過專屬驗證碼建立之連結。
_Avoid_: 授權 (auth)、連線 (connection)、配對 (pairing)

**Natural Message (自然語言指令)**:
使用者於通訊聊天室輸入非結構化日常語句（例如：`早餐 100`、`晚餐 100 公帳 現金`、`好市多 3200 公帳玉山`），由系統自動拆解並剝離「金額」、「公私帳歸屬詞彙（`公帳`、`公費`、`家用`、`私帳`、`個人`）」與「帳戶關鍵字或類型詞彙（自訂帳戶名稱，或通用類型詞 `現金`/`錢包` 對應 `Cash Wallet`、`信用卡`/`刷卡` 對應 `Credit Card`、`銀行`/`活存` 對應 `Bank Account`）」，將剩餘純品項文字作為交易備註（`note`），無論各詞彙輸入順序或是否含空白皆互不覆蓋污染；並即時雙向連動資產帳戶餘額（`Bank Account` 與 `Cash Wallet` 扣減／增加 `balance`，`Credit Card` 增加未出帳並觸發 `Credit Card Balance Reconciliation`），回傳包含現金、活存與信用卡欠款之真實 `Available Balance (淨可用餘額)`（回覆訊息全面使用純文字幾何符號如 `▪`、`•` 排版，不使用 Emoji）。Webhook 端點遇未知例外時必須捕獲並回傳 HTTP 200 與友善錯誤提示，嚴禁回傳 HTTP 500 導致 Telegram Webhook 佇列（`pending_update_count`）阻塞死鎖。
_Avoid_: 聊天指令 (chat command)、提示詞 (prompt)、快速指令 (quick entry)、固定雙詞切分 (naive 2-token split)、Webhook 500 佇列阻塞 (webhook 500 queue stalling)

---

### 認證與登入 (Authentication & Sign-in)

**Authorization Server (授權伺服器)**:
負責驗證使用者身分並核發 token 的一方，其登入頁是唯一可以輸入密碼（或日後的 passkey）的地方。自家 client 不會直接接觸到密碼。
_Avoid_: 登入 API (login API)、認證後端 (auth backend)

**Client (用戶端)**:
代表使用者向 API 存取資料的應用程式。目前只有兩個 first-party public client：`web` 與 `ios`，兩者都沒有 client secret。
_Avoid_: 裝置 (device)、前端 (frontend)

**Session (登入工作階段)**:
某位使用者在某一個 client 實例（一支手機、一個瀏覽器）上的一次持續登入，也就是「已登入的裝置」清單裡的一列。可以單獨撤銷；連續閒置 30 天沒使用就失效，沒有絕對上限。
_Avoid_: 裝置 (device)、登入紀錄 (login record)、cookie

**Access Token (存取權杖)**:
短效（15 分鐘）的通行證，代表某個 Session 在效期內存取 API 的權利。撤銷 Session 後，已經發出的 Access Token 仍然有效到過期為止。
_Avoid_: token（未加限定詞）、JWT

**Refresh Token (更新權杖)**:
屬於某個 Session、用來換取新 Access Token 的憑證。每次使用都會被換掉（輪替）；已經換掉的舊 Refresh Token 如果在緩衝期過後又被拿來使用，就視為外洩，整個 Session 會被撤銷。
_Avoid_: 長效 token (long-lived token)、記住我 (remember me)

**Legacy Token (舊版權杖)**:
相容期間由舊版 `/auth/login`、`/auth/register` 核發、效期 30 天、不屬於任何 Session 的權杖。不會出現在裝置清單，在修改密碼或重設密碼時會失效；相容模式結束後全面停用。
_Avoid_: 舊 session (old session)、Access Token

**Sign Out (登出)**:
撤銷目前這個 Session。授權伺服器不會記住瀏覽器的登入狀態，所以登出後再登入一定要重新驗證身分。
_Avoid_: 清除 token (clear token)、登出全部 (sign out everywhere，那是「登出其他所有裝置」)

**Key-Bound Session (金鑰綁定工作階段)**:
領碼時由 client 出示持有的私鑰簽出之證明，並在該 Session 記下對應公鑰指紋的 Session。此後它的 Access Token 與 Refresh Token 都只有持同一把私鑰的 client 能使用，換金鑰（同一 Session 不允許）等同重新登入。沒有綁定的 Session（過渡期）行為與現行相同。
_Avoid_: 裝置綁定 (device binding)、token 加密 (token encryption)

**Proof (所有權證明)**:
Key-Bound Session 的 client 隨每個請求附上、用私鑰簽出的短效（±60 秒）一次性憑證，證明「這個請求確實由持有私鑰者發出」，且只對該次請求的方法、網址與 Access Token 有效。伺服器對 token 端點與寫入類請求（POST/PUT/DELETE）拒絕重送；讀取類請求只靠短時間窗與 token 綁定防護。
_Avoid_: 簽章 (signature)、第二個 token (second token)

**Passkey (通行金鑰)**:
基於 WebAuthn 的無密碼登入憑證，綁定前端網域（Relying Party ID = `my-money-onion.pages.dev`），私鑰由裝置安全硬體或系統鑰匙圈（如 iCloud 鑰匙圈）保存，伺服器僅儲存公鑰與計數器。使用者可在已登入的設定頁註冊、命名或刪除 Passkey；刪除 Passkey 僅停用該金鑰未來登入，不會主動撤銷既有 Session。
_Avoid_: 生物辨識密碼 (biometric password)、Keychain 密碼

**WebAuthn OAuth Bridge (WebAuthn 授權橋接)**:
因 Web 前端（`pages.dev`）與授權伺服器（`workers.dev`）分屬不同 Public Suffix 網域無法共用 RP ID，Web 端由前端登入頁發起 Passkey 驗證並將簽章 assertion 與 PKCE `code_challenge` 送至後端 `POST /oauth/passkey/authorize`，換取授權碼後再經既有 `/oauth/token`（含 DPoP 綁定）領取 Access Token 與 Refresh Token。
_Avoid_: 跨網域 cookie、直接發放永久 token

**Biometric Login Submit (生物辨識登入送出／`biometric=1`)**:
當 iOS Client 開啟授權伺服器登入頁（`GET /oauth/authorize`）並明確傳入 `biometry`（`faceid`、`touchid`、`opticid`）時，登入模式在主登入按鈕下方顯示對應名稱與 `lucide-static` inline SVG 圖示（`scan-face`、`fingerprint`、`scan-eye`，`aria-hidden="true"`、`1.4em` 隨 `font_scale` 縮放）的描邊次要按鈕（「用 Face ID／Touch ID／Optic ID 登入」）。該按鈕是帳密表單的第二個送出鈕（`name="biometric" value="1"`），一樣驗證 Email 與密碼；成功時照常發授權碼導回 `redirect_uri`，並多帶 `biometric=1`，iOS Client 據此在登入後以裝置生物辨識保護 Refresh Token；失敗時與主登入鈕相同重新顯示表單。未傳入 `biometry`、傳入 `none` 或無法辨識的值、以及註冊／忘記密碼／重設密碼模式皆不顯示該按鈕。取代先前以 `error=passkey_requested` 導回的 Native Passkey Handoff（ADR 0044）。
_Avoid_: 在 Worker 頁面直接執行 WebAuthn (running WebAuthn on workers.dev)、未帶 biometry 時預設顯示按鈕 (showing biometric button when biometry is omitted)、Native Passkey Handoff／`passkey_requested`（已被取代）

**OAuth Login Display Parameters (授權登入頁外觀參數：`biometry` 與 `font_scale`)**:
iOS Client 請求 `GET /oauth/authorize` 時可附帶的純外觀選填參數：`biometry` 指定裝置生物辨識標籤，`font_scale` 指定相對預設字級的放大倍數（夾限 `1`～`3.1`，不合法視為 `1`）。授權登入頁採 `rem` 隨根元素字級比例放大文字與核心元件尺寸，並於切換登入／註冊／忘記密碼模式及表單送出失敗重繪時保留這兩個參數（不寫入授權交易憑證或 Session）。
_Avoid_: 寫死 px 字級導致無障礙大字級無效 (hardcoded px font sizes ignoring accessibility scaling)、切換模式或驗證失敗後遺失外觀參數 (losing display params on mode switch or error re-render)

**Transient Refresh Resilience (暫時性續期容錯)**:
Web 端在 Access Token 過期前應主動背景續期（並於分頁切回前景或網路恢復時檢查續期）；當向授權伺服器續期遭遇網路中斷或 5xx / 429 等暫時性錯誤時，嚴禁清除本機 `Refresh Token` 與 DPoP 金鑰或強制導向登入頁，僅在伺服器明確回傳 `400` / `401` 拒絕（如 `invalid_grant`、`invalid_client`）時才終止本機 Session。啟動時若仍持有 `Refresh Token` 但暫時離線，應顯示「重新連線」提示並於恢復連線後自動續期。
_Avoid_: 斷線登出 (logout on offline)、無條件清憑證 (unconditional auth wipe)

**Password Reset (忘記密碼／重設密碼)**:
於授權伺服器登入頁提供之自助密碼重設流程，透過已綁定的 LINE／Telegram 記帳機器人發送 6 位數一次性驗證碼（OTP）作為身分證明，無須外部寄信服務。發送與驗證過程一律採中性提示以避免洩漏帳號存在與綁定狀態；重設成功後立即撤銷所有裝置之 Session 與 Legacy Token（保留 Passkey 憑證），並導回登入表單重新驗證登入。
_Avoid_: Email 重設連結 (email reset link)、免驗證直接改密 (unverified password overwrite)、自動登入繞過 (auto-login bypass after reset)

---

### 前端視覺主題與載入體驗 (Frontend Theme & Loading UX)

**Dual-Theme Color System (雙主題視覺色票系統：柔和水彩淺色 ＆ 月影鈦銀灰深色)**:
全站支援透過單一「淺色 ☀️ / 深色 🌙」切換鈕即時切換雙主題：
1. **淺色模式（`:root` — Soft Watercolor 柔和水彩日系）**：以溫暖櫻花粉白（`--bg-page: #FFF5F5`）、純白卡片（`--bg-surface: #FFFFFF`）、柔霧次表面（`--bg-surface-2: #FFF8F8`）與櫻花粉邊框（`--border-color: #FFDEDE`）為基底，搭配珊瑚粉主色（`--color-primary: #FF8A8A`）與水彩藍點綴（`--color-accent: #A8D8EA`）。
2. **深色模式（`[data-theme="dark"]` — Moonlit Titanium Dimmed 月影鈦銀灰）**：採用柔霧中明度鈦銀藍灰三階表面（`--bg-page: #181B20`、`--bg-surface: #22272E`、`--bg-surface-2: #2D333B`），不走死黑高反差以消除夜間文字光暈（Halation），並統一收斂單一中性石板邊框（`--border-color: #373E47`、`--border-color-2: #2D333B`，徹底移除重複覆寫之半透明粉紅邊框）、符合 WCAG AA 對比度標準之高辨識度文字階層（`--text-primary: #ECF2F8`、`--text-secondary: #B4BECB`、`--text-muted: #8B95A5`）、溫潤櫻花粉主色（`--color-primary: #FF9494`、`--color-primary-light: #FFB8B8`、`--color-primary-dark: #E67A7A`）以及深色語意收支色（`--color-success: #56D39A`、`--color-danger: #FF7B7B`、`--color-warning: #F7B955`）。
3. **禁止寫死淺色背景與深色文字（No Hardcoded Light Surfaces or Dark Text Hexes）**：全站子區塊（如信用卡負債性質拆解、出帳預覽公私拆解、無資料空狀態、提示橫幅、徽章等）一律使用主題自適應變數（`var(--bg-surface-2)`、`var(--border-color)`、`var(--text-primary)`、`var(--text-secondary)`），嚴禁於元件行內寫死 `#FAFBFD`、`#F9FAFB`、`#F0FDF4`、`#EFF6FF` 等亮白底色（否則深色模式下會造成白底配白字），亦嚴禁寫死 `#4B5563`、`#1E40AF`、`#4338CA` 等深色字碼或 `rgba(0,0,0,0.06)` 黑底半透明膠囊（否則深色底色上過暗無法閱讀）。
4. **全域按鈕色彩繼承與卡片圖示操作鈕高辨識規範（Button Color Inheritance & Card Icon Action Buttons）**：全域 `button` 重置必須包含 `color: inherit`，且 `[data-theme="dark"]` 啟用 `color-scheme: dark`，杜絕任何 `<button>`（如帳戶與儲蓄目標卡片右上角之 `.btn-icon` 編輯／刪除鈕）因未顯式指定顏色而退回瀏覽器預設純黑（`#000000`）。卡片圖示按鈕 `.btn-icon` 統一呈現次要亮銀灰（`var(--text-secondary)`），刪除鈕 `.btn-icon.danger` 呈現醒目珊瑚紅（`var(--color-danger)`），並於行動端（`<= 640px`）賦予 `var(--bg-surface-2)` 微底色方框（與收支明細列 `.tx-action-btn` 視覺一致），確保深淺模式皆清晰好點按。
_Avoid_: 高彩度刺眼藍紫深色底 (`#1A1A2E` / `#252540`)、純黑高反差眩光 (`#000000`)、未設 `color: inherit` 導致圖示按鈕退回純黑 `#000000` 融入深色卡片 (uncolored buttons falling back to browser black `#000000` on dark cards)、深色模式下重複定義覆寫之粉紅邊框 (`rgba(255, 158, 158, 0.15)`)、元件行內寫死亮白底色導致深色模式白底配白字 (hardcoding `#FAFBFD`/`#F9FAFB` causing white-on-white text in dark mode)、寫死深灰或深藍文字導致深色模式過暗無法辨識 (hardcoding `#4B5563`/`#1E40AF` on dark surfaces)

**Skeleton Screen (骨架屏)**:
在非同步資料載入完成前，呈現與真實頁面結構（含行動端 RWD 斷點佈局）1:1 對齊的微光佔位區塊，用於防止版面跳動 (CLS) 並提供流暢的等待視覺回饋。所有骨架卡片統一沿用響應式標準內距（嚴禁寫死行內大內距），圓形圖示佔位固定比例不壓縮變形（`flex-shrink: 0`），文字與矩形佔位條具備彈性百分比／最大寬度防溢出保護（`max-width: 100%` 與 `min-width: 0`），並於行動端同步對齊三態等寬切換列、預測日期區間查詢列（且 `ForecastSkeleton` 之折線圖與主網格順序必須與真實頁面完全一致）、可收合篩選列與家庭成員名冊等真實區塊結構。
_Avoid_: 載入轉圈 (spinner)、空白佔位 (blank placeholder)、假資料 (mock data)、寫死固定像素寬度導致手機版擠壓溢出 (hardcoded pixel widths overflowing mobile cards)、圓形骨架壓縮成橢圓 (squished oval circle skeletons)、骨架區塊上下順序與真實頁面顛倒造成載入完成瞬間版面跳動 (inverted skeleton section order causing layout shift)

**Initial Mount Loading (初次載入狀態)**:
使用者首次進入頁面或完全重新整理時，在所有初始資料請求完成前呈現全頁骨架屏的狀態。
_Avoid_: 全頁轉圈 (page loading)、冷啟動 (cold start)

**Inline Refetch Transition (二度篩選過渡狀態)**:
頁面已完成初次載入後，使用者在同頁面進行篩選條件（如公私帳視角切換、月份或日期區間切換、指定帳戶過濾）變更時，保留當前視圖並以輕量局部過渡更新資料的狀態，且**僅精準請求隨該篩選條件變動之資料端點**（不隨當前篩選條件變動之基礎資料如全量帳戶選單、家庭角色、儲蓄目標或跨視角預算，僅於初次掛載或資料異動時請求），避免全頁閃爍與冗餘網路往返。
_Avoid_: 二次骨架 (secondary skeleton)、重新載入 (reload)、切換篩選時無差別重抓不隨條件變動之靜態資源 (refetching filter-invariant endpoints on scope or date change)

**Shimmer Effect (微光動效 / 溫暖水彩果凍玻璃)**:
骨架屏融合 135 度櫻粉微暖雙漸層底色、毛玻璃通透感 (blur 5px) 與雙峰果凍高光波紋自左至右循環流動的 CSS 動態效果，容器本體維持絕對座標固定，並於深色模式下對齊「月影鈦銀灰」基底與微光邊框。
_Avoid_: 容器位移 (element translation)、生硬刷光 (hard sweep)、呼吸燈 (pulse)、跑馬燈 (marquee)、冷硬死灰 (cold dead grey)

---

### 行動端優先與響應式體驗 (Mobile-First RWD & UX)

**Mobile Bottom Sheet (行動端底部抽屜彈窗)**:
在行動端小螢幕（`<= 640px`）下，所有新增與編輯表單彈窗（`.modal-box`）由螢幕置中轉化為貼齊螢幕底部向上滑出之抽屜式面板（頂部大圓角、適配動態視窗高度 `dvh` 與底部安全區 `safe-area-inset-bottom`）。標題列吸頂固定並提供至少 `44x44px` 之關閉觸控熱區，表單輸入框字級不小於 `16px` 以防止 iOS Safari 強制放大畫面，並針對窄螢幕自動將易擠壓之並排欄位（如日期選擇器）調整為單欄滿寬，同時保留二選一歸屬切換鈕（如公帳／私帳）之水平雙欄並排。
_Avoid_: 手機置中懸浮彈窗 (centered floating modal on mobile)、低於 16px 觸發強制縮放之輸入框 (sub-16px auto-zoom inputs)、誤將二元切換鈕垂直拆行 (stacked binary toggle buttons)

**Modal Layout & Tiered Sizing Architecture (彈窗分層滾動與分級寬度架構)**:
全站彈窗採用外框防護、固定標題與內部獨立滾動層的三層分離架構，杜絕直角原生卷軸穿透 24px 大圓角，並依內容複雜度落實電腦版分級寬度與行動端排版規範：
1. **結構分層重構（Three-Tier Modal Frame）**：
   - `.modal-box`（外框容器）：配置 `border-radius: var(--radius-xl)`（24px），啟用 `overflow: hidden;` 作為外層圓角遮罩防線，以 `display: flex; flex-direction: column;` 控制縱向排版，徹底杜絕原生卷軸或子容器穿透 24px 圓角。
   - `.modal-header`（固定標題列）：固定於彈窗頂部，不隨內容滾動，包含標題與關閉按鈕，享有專屬內距，關閉按鈕（`modal-close-btn`）不再受卷軸擠壓或遮擋。
   - `.modal-body`（獨立滾動層）：`flex: 1; min-height: 0; overflow-y: auto;` 承載表單或清單內容。在電腦版下套用日系輕量 6px 細圓角半透明卷軸，並設定 `scrollbar-gutter: stable;`，徹底消除卷軸出現時彈窗內容橫向跳動。
2. **電腦版彈窗分級寬度規範（Tiered Modal Sizing）**：
   - **小型確認/數值彈窗**：`maxWidth: 400px`（如預算設定、存入目標）。
   - **標準表單彈窗**：`maxWidth: 540px`（預設值，由 480px 提升至 540px，如新增/編輯帳戶、轉帳、信用卡還款、快速記帳、新增週期性收支、目標設定等，確保各類帳戶選單文字不截斷）。
   - **複雜明細與清單彈窗**：`maxWidth: 720px`（如「結帳日出帳作業預覽」與「家庭代墊報銷清單」，由 640px 提升至 720px），提供充裕水平空間給統計卡片、公私拆解與勾選明細，消除內部雙重嵌套卷軸與擁擠換行。
   - **還款快捷按鈕滿寬獨立排版与精簡按鈕文案**：信用卡繳費彈窗之快捷金額標籤抽離至金額與日期網格下方作為獨立整行（Full-width），不再擠壓於單一欄位內；確認按鈕文案精簡為「確認扣款還款」，並於行動端與取消鈕等寬並排。
   - **明細備註自然換行與行動端雙層防擠壓**：出帳預覽（Statement Rollover Modal）之收支備註解除 `nowrap` 與 `ellipsis` 單行強制截斷，採 `wordBreak: break-word` 自然多行呈現；在行動端（`<= 640px`）下，單筆消費列轉為上下雙層排版（上層呈現分類、日期、歸屬徽章與完整備註；下層呈現靠左或兩端對齊之金額與「延至下期」按鈕），且彈窗底部將提示文字獨立置於上方，下方「取消 / 確認出帳」採雙欄等寬滿寬按鈕。
   - **家庭報銷彈窗底部三鈕行動端階層排版**：家庭代墊報銷彈窗（Reimbursement Modal）底部包含「取消」、「已額外處理 (僅移出清單)」、「確認撥款沖帳」三顆操作鈕，於行動端（`<= 640px`）將主行動按鈕「確認撥款沖帳」設為獨立滿寬（100% width），次要按鈕對齊並排，消除參差不齊的擠壓折行。
   - **邀請碼與驗證碼大字展示框防溢出**：家庭邀請碼與機器人綁定驗證碼展示框具備 `max-width: 100%` 與彈性換行保護（`flex-wrap: wrap`），防止大字距代碼連同複製按鈕撐破窄螢幕。
   - **行動端自適應**：在 `<= 640px` 下，所有分級彈窗統一自動自適應為 100% 滿寬之底部抽屜（Bottom Sheet），維持安全區與吸頂標題列體驗。
_Avoid_: 外框直接設 overflow-y 導致直角卷軸刺穿圓角 (overflow-y directly on rounded modal-box piercing 24px corners)、Header 隨內容滾走 (header scrolling away with content)、複雜清單塞入窄彈窗造成雙重卷軸 (cramping wide tables into narrow modal causing nested double scrollbars)、卷軸出現時內容橫向跳動 (content layout shifting without scrollbar-gutter)、單行省略截斷導致無法讀取完整備註 (truncating transaction notes with ellipsis)、手機版出帳明細單行硬塞備註與金額及延期鈕導致文字壓成直書 (single-row cramming of note, amount, and defer button on mobile)、過長冗餘之確認按鈕文案撐爆手機頁尾 (verbose 15-char confirm button text overflowing mobile modal footer)

**Collapsible Mobile Filter Bar (行動端可收合進階篩選列)**:
在收支明細頁（Transactions）的行動端視角（`<= 640px`）下，篩選工具列預設僅常駐顯示「三態帳本視角等寬切換器」、「關鍵字搜尋框」與附帶已啟用篩選數徽章之「進階篩選收合按鈕」，將起始／結束日期、收支類型、分類、帳戶等次要篩選條件預設折疊收合；展開時，起始與結束日期輸入框採單欄滿寬（`grid-column: 1 / -1`）呈現，確保在 `16px` 防縮放字級下完整顯示 `YYYY-MM-DD` 與原生月曆圖示而不被裁切；同時將篩選結果統計列之「總收入、總支出、淨收支」轉為三欄等寬網格，且金額數值維持完整不斷字（嚴禁使用 `word-break: break-all` 導致大額數字被攔腰切斷換行），確保使用者進入頁面第一屏即可清晰檢視收支明細。
_Avoid_: 手機首屏全展開篩選牆 (full-screen uncollapsed filter wall)、雙欄窄網格截斷 16px 日期字串 (2-column narrow grid clipping 16px date inputs on mobile)、對統計金額設 `word-break: break-all` 導致數字攔腰斷行 (mid-number line breaks caused by `word-break: break-all`)

**Two-Deck Mobile Transaction Row (手機版收支明細列雙層防誤觸排版)**:
在行動端小螢幕（`<= 640px`）下，單筆收支明細列（`TransactionRow`）將金額固定靠右上對齊，讓左側分類圖示與中間「分類・備註・徽章・帳戶」享有完整水平寬度；當該列包含操作按鈕（編輯、刪除或系統保護標籤）時，操作區自動獨立下移靠右排列並放大按鈕觸控熱區與安全間距，防止備註擠壓成細長多行及手指誤觸刪除。
_Avoid_: 單行硬塞金額與微型編刪鈕 (single-line cramming with tiny action icons)、緊貼誤刪風險 (adjacent micro delete button)

**Mobile Account Action Grid (手機版帳戶管理 2x2 快捷網格與觸控優化)**:
在帳戶管理頁（Accounts）的行動端視角（`<= 640px`）下，頂部四項核心操作（「ATM 提款／轉帳」、「新增現金錢包」、「新增銀行存款帳戶」、「新增信用卡」）自動排列為對齊之 `2x2` 雙欄等寬網格按鈕；各類帳戶卡片（含現金、銀行存款、信用卡）標題列統一維持名稱／徽章區（`min-width: 0`）與右側編輯／刪除圖示（`flex-shrink: 0`，至少 `36x36px` 觸控盒）水平兩端對齊不擠壓；銀行存款卡片內之「綁定自動扣繳信用卡」子列於行動端自動轉為上下雙行（上行顯示卡名、下行靠右顯示「已出帳 · 總待繳」金額明細），避免長金額擠扁卡名；信用卡「已出帳待繳款 / 未出帳」雙欄區塊於手機版垂直堆疊時具備清晰間距與分隔線，且「校準」與「出帳作業」按鈕提供充足觸控高度與彈性換行空間。
_Avoid_: 頂部四鈕鋸齒狀折行堆疊 (jagged 4-button wrapping stack)、18px 微型校準按鈕 (micro 18px action buttons)、綁定扣繳卡子列單行硬塞雙金額導致卡名縮成單字 (bound card row squeezing card name to 1 char due to nowrap dual amounts)

**Mobile Chart & Timeline Adaptation (手機版統計圖表與預測時間軸自適應)**:
在統計圖表頁（Analytics）與現金流預測頁（Forecast）的行動端視角（`<= 640px`）下，統計頁頂部之月份選擇器（`input[type="month"]`）於 `.header-actions` 中自動彈性滿寬展開（解除固定 `150px` 寬度限制）；長條圖與折線圖之 X 軸自動啟用簡短月份／日期格式與防重疊跳格（`minTickGap`）；圓餅圖圖例於小螢幕改為單欄左右對齊列表以完整呈現分類名稱、百分比與金額；每月預算進度列與預測排程事件卡片皆轉為上下雙層結構，且預測時間軸解除固定高度內部捲軸限制，隨頁面自然滾動。
_Avoid_: 圖表 X 軸標籤重疊黑塊 (overlapping X-axis tick labels)、圓餅圖例雙欄截斷金額 (truncated 2-column pie legend)、手機局部捲軸陷阱 (nested scroll trapping)

**Mobile Advance Breakdown Card List (手機版家庭代墊與報銷雙層明細列)**:
在家庭協同頁（Family）的行動端視角（`<= 640px`）下，「代墊與報銷明細（含待報銷與已結清）」與「共同基金撥款沖帳紀錄」全面捨棄固定最小寬度之橫向捲動表格，轉化為免橫向滑動之上下雙層緊湊列（第一行左列類別與備註、右列金額；第二行左列日期、右列扣款／轉入帳戶與 `.fb-cell-action` 編輯／刪除按鈕，確保 `.reimb-cols` 與 `.settled-cols` 皆完整配置 `action` 網格區域）；「目前待報銷墊付款項」子區塊頂部之批次操作鈕（「全選」與「已額外處理・移出清單」）於行動端支援彈性換行與滿寬對齊；代墊成員概覽之「累計公帳墊付」與「已獲撥款報銷」於窄螢幕自動上下分行並隱藏行間分隔圓點，操作按鈕採雙欄等寬並排。
_Avoid_: 手機版四欄強制橫向捲動表格 (horizontal-scroll 4-column table on mobile)、換行尾端殘留分隔圓點 (dangling separator dot on wrap)、漏設 `.reimb-cols .fb-cell-action` 網格區域導致撥款紀錄編刪按鈕錯位 (missing grid-area mapping for reimbursement action buttons on mobile)

**Mobile Household Roster & Anti-Cramming Layout (手機版家庭成員名冊與卡片防擠壓排版)**:
在行動端小螢幕（`<= 640px`）下，全站卡片統一遵循行動端緊湊內距（嚴禁以行內固定大內距覆蓋導致內容可用寬度受壓縮），並維持完整之間距與膠囊徽章色彩體系。全站卡片標題列（如總覽頁近期收支／資產帳戶摘要、儲蓄目標卡片 `GoalCard` 等）左側標題區統一配置 `min-width: 0`、右側操作鈕或連結配置 `flex-shrink: 0` 防擠壓保護；總覽頁之「本月預算超支警示」長文字徽章解除 `white-space: nowrap` 單行限制，允許於窄螢幕自然多行換行以防止橫向破版。家庭群組成員名冊單筆卡片採上下結構：頂部列由左側「圓形頭像＋姓名＋角色膠囊徽章」與右側「移除」操作鈕同行兩端對齊；底部資訊區之「電子信箱」與「加入時間」於手機版自動轉為上下獨立分行並隱藏中間分隔圓點；家庭頂部橫幅操作鈕則於手機版滿寬等寬並排。
_Avoid_: 頭像與文字零間距緊貼 (zero-gap avatar/text collision)、移除按鈕掉至左下角孤行 (orphaned bottom-left remove button)、行內固定大內距擠壓窄螢幕 (hardcoded inline padding squeezing mobile width)、超支警示長徽章 `nowrap` 撐破手機螢幕 (long over-budget alert badge overflowing viewport due to `nowrap`)

**Mobile Segmented Scope & Quick-Add FAB (手機版等寬三態切換與全域懸浮記帳鈕)**:
在行動端視角（`<= 640px`）下，全站三態視角切換器（`ScopeTabBar`）自動轉為 100% 滿寬之三等分控制項（三個按鈕 `flex: 1` 置中均分，不附冗餘前綴文字）；各頁面頂部操作按鈕統一收斂於 `.header-actions` 容器以確保小螢幕滿寬對齊；同時於行動端右下角（底部導覽列上方安全區）提供水彩粉紅圓形「`+`」懸浮快速記帳按鈕（Quick-Add FAB），支援隨時一鍵喚起記帳表單。
_Avoid_: 手機版偏左不等寬三態按鈕 (left-aligned uneven scope tabs)、裸露未對齊之頂部操作鈕 (unwrapped header action buttons)

**Formula Breakdown Tooltip (統計公式透明化氣泡提示)**:
在全站所有統計數據儀表板卡片（總覽、帳戶管理、週期收支、儲蓄目標、現金流預測之 `.stat-card`）以及次要統計摘要區塊（收支明細篩選總計、統計分析消費總額與公帳分攤佔比、家庭協同代墊待報銷淨額）之指標標題旁，配置 `Info`（小 `i`）向量圖示按鈕。點擊時彈出自動防超出螢幕邊界之懸浮氣泡框（Popover Tooltip，點擊外部或再次點擊即收合，不撐開原卡片高度），框內分上下兩層同時呈現「會計計算公式定義」與「代入當前視角實際金額之驗算算式」，讓使用者能即時核對每一項統計指標的組成來源。
_Avoid_: 僅支援滑鼠懸停而手機無法觸發之原生 title (hover-only native title tooltip)、無實際數值代入之空泛文字 (static formula without live values)、超出手機螢幕右側邊界之氣泡框 (off-screen overflowing popover)

**Brand Logo & Dual-Variant Identity (品牌標誌與雙變體識別系統)**:
系統專屬向量品牌標誌以「翻開雙頁線條記帳本＋上方飄浮愛心與小錢幣」為核心意象（呼應柔和水彩日系與個人／家庭雙帳本定位）：左頁以珊瑚粉線條與淡粉暈代表個人私帳、右頁以柔天藍線條與淡藍暈代表家庭公帳，書頁上方輕盈飄浮珊瑚粉線條愛心與暖杏金線條 `$` 小錢幣，全面取代通用 `BookHeart` 圖示。同源 SVG 依場景劃分兩種變體：
1. **Mark 純圖示（無外框）**：用於桌面側邊欄、行動端頂欄等導覽區域，自動適配淺色與深色模式背景。
2. **Badge 徽章（圓角暖白漸層底框，深色模式轉月影鈦銀微光底框）**：用於 Web 登入頁、後端 OAuth 授權頁內聯圖示、瀏覽器 `favicon.svg`、手機主畫面 `apple-touch-icon` 與 PWA `manifest.webmanifest` 圖示。
3. **情境雙語品牌字標並存**：站內導覽與網頁 `<title>` 維持「我的記帳本」，登入頁與後端 OAuth 授權頁維持「My Money」（搭配副標「個人與家庭雙帳本」）。
_Avoid_: 繼續使用通用第三方 `BookHeart` 圖示作為品牌標誌 (using generic `BookHeart` icon as brand logo)、缺失 `favicon.svg` 或手機主畫面圖示 (missing favicon or mobile home screen icons)、厚重不透氣實心色塊破壞日系輕盈線條感 (heavy solid blocks clashing with airy line-art aesthetic)

---

### 系統架構與 API 效能規範 (System Architecture & API Performance)

**Indexed Ledger Scans & Keyset-Compatible Pagination (收支明細複合索引覆蓋與相容分頁)**:
針對龐大帳本歷史查詢（`GET /transactions`），依據常用篩選條件組合（使用者、公私帳視角、日期區間、帳戶等）建立高效複合覆蓋索引，包含 `(user_id, is_shared, date)`、`(account_id, type, is_billed, date)` 等。API 分頁維持原生 `limit` 與 `offset` 參數以向下相容現有前端，並同時支援以 `(date, created_at, rowid)` 組合之游標式（Cursor-based / Keyset）篩選機制，杜絕大資料量深層翻頁時的全表掃描開銷。
_Avoid_: 無索引任意多欄位過濾掃描 (unindexed multi-column table scans)、破壞現有前端分頁協定 (breaking existing pagination contract)

**Paired Transaction Reverse Indexing (成對平帳流水反向檢索索引)**:
針對內部轉帳、ATM提款、信用卡還款與公帳報銷之成對紀錄（`findPairedTransaction`），在資料庫層級顯式建立 `idx_tx_pair_id ON transactions(pair_tx_id)`。當系統執行成對反向配對或自癒修復時，直接透過 B-Tree 索引達成 $O(1)$ 瞬時檢索，徹底根除每次編輯或刪除成對收支時對數萬筆交易紀錄執行的全表循序掃描 (Full Table Scan)。
_Avoid_: 缺乏外鍵索引的反向匹配 (reverse lookup without foreign index)、每次編輯刪除遍歷全表 (iterating full table on every paired operation)

**Event Direct Projection Forecast Engine (事件直接投影預測引擎)**:
在現金流預測（`GET /forecast`）與即時採購試算（`POST /forecast/purchase-check`）中，預測演算架構由「逐日 365 次外層迴圈檢查各個定期項目（$O(\text{days} \times N)$）」全面重構為「針對定期項目依週期直接投影發生日（$O(N \times \text{cycles})$）」。月繳項目一年僅計算 12 次、年繳僅計算 1 次，消除 95% 以上之無效日期建構與迴圈運算；同時對同一張信用卡之多個週期結帳與到期日推算於單次請求生命週期內實施記憶化（Memoization），保留 365 天長程預測視野並達成毫秒級極速回應。
_Avoid_: 365 天逐日雙重迴圈重算 (365-day nested day-by-day recalculation)、無快取重複建立 Date 物件 (redundant Date instantiation)、為求效能犧牲長期預測視窗 (sacrificing forecast horizon for speed)

**Lightweight ETag, Cross-Origin 304 Header Retention & Global Error Boundary (輕量 ETag、跨網域 304 CORS 標頭保留與全域錯誤防線)**:
後端為所有唯讀查詢端點（`GET /accounts`、`/transactions`、`/budgets`、`/goals`、`/recurring`、`/forecast` 等）引入基於回應內容雜湊的輕量 ETag 標頭，並於 CORS 中明確暴露 `ETag` 標頭且接受客戶端 `If-None-Match` 請求標頭。為防止 Hono `etag()` 在命中 `304 Not Modified` 重建空回應時清除 CORS 標頭導致跨網域請求（`pages.dev` → `workers.dev`）遭瀏覽器阻擋，`etag()` 必須將 `access-control-allow-origin`、`access-control-expose-headers`、`access-control-allow-credentials` 列入 `retainedHeaders`。前端 API Client 發送 `fetch` 時指定 `cache: 'no-store'` 以交由記憶體 `apiCache` 單一控管條件式快取，避免瀏覽器原生 HTTP 快取在寫入清空後干擾；若因競態收到 `304` 但本地無快取，則自動無條件重發請求取回最新資料。後端同時配置全域 `app.onError`，以 `console.error` 記錄完整例外與請求路徑，並回傳具備 CORS 標頭之標準 `500` JSON（`{ success: false, error: '伺服器內部錯誤，請稍後再試' }`）。
_Avoid_: `304 Not Modified` 回應漏失 `Access-Control-Allow-Origin` 導致跨網域 `Failed to fetch` (stripping CORS headers on 304 responses)、瀏覽器原生快取與記憶體快取雙重控管導致空 `304` 拋錯 (dual HTTP cache conflict after `apiCache.clear()`)、未捕捉例外回傳無 CORS 純文字 500 (unhandled exceptions returning plain-text 500)

**Exact B-Tree Range Aggregation (統計報表閉區間範圍掃描)**:
月度收支、分類統計、家庭分攤報表（`GET /transactions/summary/*`）與月度預算支出聚合（`GET /budgets`）全面廢除 `date LIKE 'YYYY-MM%'` 字串模糊前綴比對，重構為明確之日期閉區間比較（`date >= ? AND date <= ?`），完全釋放 SQLite / D1 之 B-Tree 索引範圍掃描（Range Scan）能力；配合包含 `(user_id, is_shared, type, date)` 之統計複合索引，確保在百萬級記帳數據下仍能在數毫秒內完成聚合計算。
_Avoid_: 依賴字串 LIKE 前綴查詢阻礙索引範圍查找 (using string LIKE prefixes blocking B-Tree range scans)、聚合端點缺乏複合覆蓋索引 (missing composite index for grouping)

**SQL-Aggregated Card Metrics & Household-Scoped Settled Events (信用卡指標 SQL 端聚合與預測已結清事件範圍化)**:
`computeCreditCardsReadOnlyMetrics` 由 SQLite / D1 端以 CTE `GROUP BY` 單次批次聚合各卡之當期未出帳消費／刷退／還款沖抵與已出帳公私帳分流（每張卡僅回傳單列彙總數據），不再將信用卡全部歷史交易明細載入 Worker 記憶體逐筆迴圈計算，並維持公私帳欠款與已報銷代墊轉列私帳之 100% 會計準確度。同時，`forecast_settled_events` 讀取嚴格限定本人與家庭成員（`WHERE user_id IN (...)`），杜絕跨家庭全表讀取；`transactions` 補齊排序專用複合索引 `idx_tx_user_sort ON transactions(user_id, date DESC, created_at DESC, id DESC)` 並移除重複索引 `idx_tx_pair`。
_Avoid_: 將全歷史信用卡交易撈入 Worker 記憶體逐筆累加 (loading full card transaction history into Worker memory)、無 `WHERE` 全表讀取 `forecast_settled_events` (unscoped full-table scan on settled events)、同欄位重複索引增加寫入開銷 (duplicate indexes on `pair_tx_id`)

**Server-Side Transaction Filtering, Range Summary & Modification Timestamp (後端收支篩選、區間全量統計與修改時間追蹤)**:
`GET /transactions` 支援 `type`（`income` | `expense`）與 `q`（不分大小寫模糊比對備註 `t.note`、分類名稱 `t.category`、帳戶名稱 `a.name`、記帳人名稱 `u.name`）查詢參數，並可與 `scope`、`from`、`to`、`account_id`、`category`、`cursor`、`limit` 組合使用。同時提供 `GET /transactions/summary/range` 端點，接收相同篩選條件並依全量加總規則（包含信用卡還款、內部轉帳、ATM提款、公帳代墊報銷等系統分類）回傳 `{ total_income, total_expense, count, by_day: [{ date, income, expense }] }`，供分頁客戶端直接取得精確區間總計與每日小計。`transactions` 資料表新增 `updated_at` 欄位（新建與歷史資料為 `null`，於 `PUT /transactions/:id` 時寫入 UTC 時間字串並隨 API 回傳）。
_Avoid_: 分頁客戶端僅對已載入頁面局部加總導致總計與每日小計失真 (summing only loaded page rows on paginated clients)、新建收支時預填 `updated_at` (populating `updated_at` on creation)

**Masked Card Payment Account Privacy, Household Ownership Succession & Forecast Card Deduction Transparency (私卡扣款帳戶遮蔽、家庭擁有者無縫繼承與預測預扣卡款透明化)**:
1. **私卡與私帳預設扣款帳戶脫敏與寫入校驗（#156）**：`GET /accounts` 中他人私卡脫敏分支（`is_masked: true`）或信用卡所綁定之扣款銀行為非當前登入者本人之個人私帳銀行（`payment_account_is_joint = 0 AND payment_account_user_id != userId`）時，強制將 `payment_account_id`、`payment_account_name`、`payment_account_balance`、`payment_account_is_joint`、`payment_account_bound_count`、`payment_account_bound_billed_total` 設為 `null`；若綁定之扣款銀行為家庭共同基金銀行（`is_joint = 1`），則對家庭全體成員公開該扣款銀行名稱、存款餘額與待扣充足狀態。`POST /accounts` 與 `PUT /accounts/:id` 僅允許 `type === 'credit_card'` 寫入 `payment_account_id`（非信用卡強制為 `null`），且綁定目標必須為當前使用者可見（本人擁有或 `is_joint = 1` 家庭共同帳戶）之 `bank` 類型帳戶。
2. **家庭建立者刪帳／退群無縫繼承（#121）**：當使用者執行 `DELETE /auth/account` 或 `DELETE /households/leave` 且所屬家庭尚有其他成員時，系統自動將下一順位成員（優先其他 `admin`，其次最早加入之 `member`）升為 `admin` 並接手 `households.created_by`（及有效邀請碼之 `inviter_id`），防止 `ON DELETE CASCADE` 連帶毀滅整個家庭群組。
3. **預測起始餘額預扣卡款欄位（#98）**：`GET /forecast` 回傳新增 `cardDeduction`（第 0 天預扣之信用卡待繳款），Web 端預測頁當 `cardDeduction > 0` 時於公式氣泡明確列出 `現金 + 存款 - 預扣卡款 = 起始餘額`。
4. **跨端（Web / iOS）顯示詞彙對照備忘（#87）**：Web 端維持本文件標準術語（「銀行存款帳戶」、「現金錢包」、「收支明細」），iOS 端（`raychiutw/my-money.ios`）於部分介面呈現精簡詞彙（「活存帳戶」、「現金」、功能入口「記帳」），雙方共享完全一致之 API wire 欄位與系統分類名稱。
_Avoid_: 脫敏私卡洩漏個人扣款帳戶 ID 與名稱 (leaking `payment_account_id`/`payment_account_name` on masked cards)、原建立者刪帳導致多成員家庭遭 `CASCADE` 連帶抹除 (cascading deletion of multi-member household on creator account deletion)、預測頁起始餘額算式漏列預扣卡款導致恆等式不成立 (omitting `cardDeduction` from starting balance formula)
