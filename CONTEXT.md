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
個人或共同持有的活期存款正資產帳戶。
_Avoid_: 現金帳戶 (cash account)、活存帳戶 (deposit account)

**Credit Card (信用卡帳戶)**:
發卡機構授予循環信用額度之負債帳戶。
_Avoid_: 負債帳戶 (debt account)、卡片 (card)

**Available Balance (淨可用餘額)**:
名下隨身現金錢包與活存銀行存款總額，扣除所有信用卡總欠款（已出帳與未出帳）後的實質淨可用資產。
_Avoid_: 淨值 (net worth)、可用額度 (credit limit)、總餘額 (total balance)

**Disposable Cash (真實可支配現金)**:
淨可用餘額進一步扣除當期週期收支每月平均預留與進行中儲蓄目標款項後的安全自由花費餘額。
_Avoid_: 零用錢 (pocket money)、空閒餘額 (free cash)、閒置資金 (idle cash)

**Explicit Account Selection (顯式帳戶選取原則)**:
在新增交易記帳、帳戶互轉、信用卡還款與公帳報銷等表單中，系統嚴格禁止擅自預選任何帳戶或信用卡（無自動預設值），強制使用者主動檢視並選取會計主體；未選取時表單透過原生 required 與介面警示進行防呆攔截。必填欄位之佔位項目設為 disabled 禁止反選回空；非必填之週期收支則提供「無特定帳戶」並允許選取與切換。
_Avoid_: 隱性預選 (implicit default)、首項默認 (first item auto-select)、自動代入 (auto-fill assumption)

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

**Direct Ledger Sign Aggregation (收支正負號全量直觀加總)**:
在「收支明細頁（上方篩選摘要之總收入／總支出／淨收支、以及每日分組卡片右上角小計）」與「儀表板（當月收入／支出／當月淨收支，`GET /transactions/summary/monthly`）」中，針對當前篩選條件與視角下之**所有相關收支紀錄全部納入計算**，不做任何隱藏分類剔除：
1. **總收入（與當日 `+` 收入小計）**：凡明細為正項（`type = 'income'`，畫面顯示 `+`）一律列入收入加總。
2. **總支出（與當日 `-` 支出小計）**：凡明細為負項（`type = 'expense'`，畫面顯示 `-`）一律列入支出加總。
3. **淨收支**：`總收入 － 總支出`，確保畫面列表上每一筆看得到的 `+` 與 `-` 明細加總結果 100% 與上方「總收入、總支出、淨收支」及每日小計完全吻合。
_Avoid_: 隱藏排除特定分類導致畫面明細與上方總計數字兜不攏 (silently excluding categories so visible rows do not sum to totals)

**Statement Rollover (結帳日出帳作業)**:
結帳日到達後，在持卡人尚未手動點擊「出帳作業」確認前，當期刷卡消費（含結帳日當天及該結帳週期內明細）一律維持為未出帳（`is_billed = 0`）並保留於「未出帳款（`unbilled`）」顯示，嚴禁於結帳日當天自動將未出帳歸零或未經出帳作業即覆寫為 `is_billed = 1`。唯有當使用者主動執行「出帳作業」時，系統才將指定結帳週期內之有效消費淨額（消費支出總額扣除刷退退款，排除延至下期者）一次性移轉合併至已出帳待繳款（`balance`），並將參與出帳之明細標記為已出帳（`is_billed = 1`）。
_Avoid_: 結帳日未經手動出帳即自動歸零未出帳 (auto-zeroing unbilled on statement day before manual rollover)、帳單重算 (recalculation)、全額滾入 (blanket carryover)

**Deferred Statement Billing (延至下期帳單)**:
在記錄或編輯信用卡消費或刷退時，手動標記該筆收支延至下個結帳週期再行出帳與沖抵的屬性（defer_to_next_statement），適用於商家延遲請款、跨結帳日刷卡或跨期退款。在當期出帳作業時自動保留於未出帳，於下一期出帳作業時自動納入結算。當使用者在收支明細中編輯收支並勾選「延至下期帳單」（或將收支日期改至最近結帳日之後）時，系統立即將該筆收支之出帳狀態重置為未出帳（`is_billed = 0`），並自動同步重算該信用卡之未出帳金額（`unbilled`）。
_Avoid_: 延遲繳款 (delayed payment)、跨期借貸 (cross-period loan)、下期消費 (next cycle expense)

**Billed Status (出帳狀態)**:
每筆信用卡收支之結算狀態標記（is_billed），明確劃分「未出帳 (0)」與「已出帳 (1)」，作為帳單出帳作業、收支明細徽章顯示與未出帳自動校準之絕對準則。`is_billed = 1` 僅能由使用者手動執行「出帳作業（Statement Rollover）」寫入；嚴禁於系統啟動遷移或一般校準時，將尚未執行出帳作業之當期交易強制覆寫為 `is_billed = 1`。
_Avoid_: 帳單狀態 (bill status)、結案標記 (settled flag)、未經出帳作業強制覆寫為已出帳 (prematurely overwriting unbilled transactions to is_billed = 1 on statement day)

**Two-Tier Debt Rollback (雙層負債回退)**:
當編輯或刪除歷史刷卡消費收支時，負債回退程序優先扣減未出帳款（Unbilled Debt）；若未出帳款已不足扣（款項已於結帳日出帳作業中結轉至已出帳或已被還款沖銷），剩餘回退差額自動溢出扣減已出帳待繳款（Billed Debt），確保欠款全額精準返還。若為同帳戶編輯，應先計算新舊收支之單一淨差額（Single Net Delta）再行回退或認列，嚴禁分步覆蓋。
_Avoid_: 雙步覆蓋 (two-step overwrite)、夾零截斷 (zero clamping)、已出帳凍結 (billed freeze)

**Credit Card Balance Reconciliation (信用卡未出帳自動校準)**:
針對信用卡帳戶，使用者點擊「校準」、載入帳戶列表或新增／編輯信用卡收支時，系統依據該卡之結帳日與實際最近一次手動出帳紀錄（`last_rollover_at`）執行**狀態自癒與未出帳淨額校準**：
1. **未經手動出帳之當期交易保護與自癒復原**：若當前日期已達或超過本期結帳日（$S_{\text{cutoff}}$），但該卡於本期結帳日當天或之後尚未執行過手動「出帳作業」（即 `last_rollover_at` 為空或早於 $S_{\text{cutoff}}$），則本期結帳週期（`date > S_prev`）仍屬於「待手動出帳之未出帳區間」，系統自動將該區間內曾被誤標為 `is_billed = 1` 之交易修復還原為 `is_billed = 0`（未出帳），絕不提前將 `date <= S_cutoff` 強制改為 `is_billed = 1`。
2. **純粹未出帳淨額加總**：精準加總所有 `is_billed = 0` 之未出帳區間內「有效消費支出總額 － 刷退退款總額」（$$\max(0, \sum \text{未出帳消費} - \sum \text{未出帳刷退})$$），完全不扣減 `unbilled_offset` 還款紀錄以免溢扣上期繳卡費，並即刻復原公私帳刷卡分流（`shared_debt` 與 `personal_debt`）。
_Avoid_: 結帳日當天未按出帳作業卻把未出帳強制歸零 (zeroing unbilled on statement day before manual rollover)、全額還款扣減 (full repayment deduction)、溢繳還款誤扣 (unbilled_offset deduction)

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
從家庭共同基金直接撥款轉帳至個人帳戶，以沖銷成員累積之家庭公帳待報銷總額的平帳作業。
_Avoid_: 結算 (settlement)、退款 (refund)、還錢 (payback)、一鍵報銷 (one-click reimburse)

**Advance Items Breakdown (代墊與報銷明細)**:
家庭頁面中各成員的透明流水帳明細，包含「個人墊付公帳消費清單（日期、類別、備註、扣款個人帳戶、金額）」以及「共同基金撥款報銷沖帳紀錄」，便於雙方隨時核帳與檢驗結清狀態。
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

**Self-Discipline Reimbursement (受限自律撥款報銷)**:
一般家庭成員僅能從家庭共同基金為「本人累積之公帳代墊款」執行撥款報銷至個人正資產私帳，嚴禁越權動支基金撥款予其他成員；家庭管理員則具備全額審批與為任一成員撥款之管理權限。
_Avoid_: 自由提款 (unrestricted withdrawal)、代領 (proxy reimbursement)

---

### 帳本視角與範疇 (Ledger Scope & Filter Terminology)

**Vector SVG Icon System (全站向量圖示系統)**:
全站介面（包含導覽、頁面標題、統計卡片、空狀態插圖、三態視角切換、交易列與預測狀態徽章、27 種收支分類圖示與 12 款儲蓄目標圖示）全面採用 `lucide-react` 向量 SVG 圖示，徹底捨棄系統字型 Emoji。瀏覽器原生 `<select><option>` 下拉選單僅呈現乾淨純文字；Telegram 與 LINE 機器人純文字回覆亦移除 Emoji，改用純文字幾何排版符號（如 `▪`、`•`）。
_Avoid_: 系統字型 Emoji (system font emoji)、跨平台不一致繪文字 (platform-dependent pictographs)

**Unified Ledger Scope (統一帳本範疇體系)**:
全站各頁面（Dashboard 總覽、Transactions 收支明細、Accounts 帳戶資產、Recurring 週期收支、Analytics 財務分析、Forecast 現金流預測）在提供資料範圍過濾或切換檢視時，一律採用「全部 (`all`)」、「公帳 (`household`)」、「私帳 (`personal`)」三態結構，並固定搭配高對比 Lucide 向量 SVG 圖示：`Globe` 全部、`Home` 公帳、`Lock` 私帳。切換器為純選項群組，不附「檢視範圍」等標題文字；彈窗內之公帳／私帳歸屬二態按鈕沿用同一 SVG 圖示與用語。全站徹底消除「全貌合併」、「家庭公用 (共同基金/家庭卡)」、「合併」等不一致用語及任何 Emoji 符號。
_Avoid_: 全貌合併 (full merge)、檢視合併 (combined view)、家庭公用 (household common)、Emoji 視角符號 (emoji scope pictographs)

**All Scope (全部)**:
全站三態切換的首個選項（value: `all`，搭配 `Globe` 向量地球圖示），聚合呈現目前登入者之「個人私帳」以及家庭全體成員共用之「家庭公帳／共同基金」，提供全方位家庭財務與資產流水概覽。
_Avoid_: 全部 (本人 + 家庭公用) (all with verbose suffix)、全貌合併 (complete merge)、總體 (total)

**Shared Scope (公帳)**:
全站三態切換的第二個選項（value: `household`，搭配 `Home` 向量房屋圖示），專注呈現標記為家庭公用之收支流水（`is_shared = 1`）、家庭共同基金帳戶（`is_joint = 1`）與共同信用卡，完全聚焦於家庭公共生活財務。
_Avoid_: 家庭公帳 (household shared)、家庭公用 (共同基金/家庭卡) (verbose household tag)

**Personal Scope (私帳)**:
全站三態切換的第三個選項（value: `personal`，搭配 `Lock` 向量鎖頭圖示），嚴格僅呈現登入者本人名下之個人私密收支（`is_shared = 0`）、個人現金皮夾、活存銀行存款與個人信用卡（`is_joint = 0`），徹底隔離家庭公帳與他人帳務。
_Avoid_: 個人私帳 (personal account verbose)、無圖示純文字私帳 (plain text without canonical SVG icon)

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
按規律頻率（月、雙月、季、半年、年）固定重複發生的週期性收入或支出。
_Avoid_: 訂閱 (subscription)、固定支出 (fixed expense)、週期契約 (contract)

**Recurring Ledger Attribution (週期收支公私帳歸屬)**:
每筆週期收支具備顯式之公私帳歸屬標記（`is_shared`：搭配 `Home` 圖示之公帳 / 搭配 `Lock` 圖示之私帳）。於表單選取扣款帳戶時自動預帶該帳戶之公私屬性，並允許手動切換以支援「以個人私卡固定代扣家庭公帳（如水電、網路費）」之代墊情境。私帳週期項目僅建立者本人可見與改刪；公帳週期項目對全體家庭成員透明共享，並由建立者與家庭管理員共治管理。
_Avoid_: 純依賴帳戶歸屬 (account-only inference)、無公私帳區分之固定收支 (unscoped recurring item)

**Exact Recurring Schedule (確切週期繳費排程)**:
週期收支必須精確綁定執行月份與日期，包含月繳（每月天）、雙月繳（單數月/雙數月）、季繳（起算月 1/2/3 每季循環）、半年繳（起算月 1~6 每半年循環）與年繳（指定 1~12 月份）。在現金流預測中，遇大小月或二月天數不足時，一律自動平貼（clamp）至該月份最後一日完成扣款與模擬，嚴禁粗暴以月份倍數模除或跨月推遲。
_Avoid_: 模除猜測 (modulo guessing)、固定雙數月 (hardcoded even months)、跨月遞延 (month overflow drift)

**Amortization (週期支出每月平均)**:
將年繳、季繳等長週期大額支出平攤轉化為每月標準額度資金負擔之試算過程，並隨當前選擇的三態視角（全部 / 公帳 / 私帳）動態過濾對應之週期收支項目進行分攤加總。
_Avoid_: 分攤平滑 (amortization smoothing)、分期 (installment)、平滑化 (smoothing)、攤提 (proration)

**Scoped Cash Flow Forecast (三態現金流預測)**:
支援切換「全部 (`all`)」、「公帳 (`household`)」、「私帳 (`personal`)」之未來 60 天逐日資金流模擬引擎。各視角之第 0 天起始基準餘額為該視角下之「現金錢包總額 ＋ 銀行存款總額」實際正資產餘額（未設定繳款日之信用卡欠款除外），並將信用卡欠款依結帳週期拆分為「已出帳待繳款（排入最近一次繳款日）」與「未出帳款（排入下一次結帳日出帳後之繳款日）」分別排入 60 天時間軸扣減（避免於第 0 天重複預扣或跨期混同），依視角過濾未來 60 天預定發生之週期收支與繳卡費排程事件，於時間軸卡片標示 `Home` 公帳 / `Lock` 私帳向量徽章與扣款帳戶。
_Avoid_: 單一混合預測 (unscoped mixed forecast)、第 0 天重複預扣未出帳卡費 (day-0 double deduction of unbilled debt)、將未出帳與已出帳混綁於同一期繳款日 (lumping unbilled debt into current billed due date)

**Card Payment Event (繳卡費事件)**:
現金流預測 60 天時間軸上，依信用卡帳務狀態拆分為兩類獨立扣繳支出事件：
1. **已出帳繳卡費（`繳卡費 · 卡名（已出帳）`）**：金額為該卡歸屬當前視角之已出帳待繳款 (`balance > 0`)，排入自今日起算**最近一次即將到來的繳款日（Payment Due Day）**。
2. **未出帳繳卡費（`繳卡費 · 卡名（未出帳）`）**：金額為該卡歸屬當前視角之未出帳款 (`unbilled > 0`)，先依該卡結帳日（Statement Day）推算**下一次結帳日**（若今日已過本月結帳日或當期已存在已出帳帳單，則為下月結帳日），再排入**該結帳日出帳後的第一個繳款日（Payment Due Day）**。
兩筆事件於時間軸上各自獨立顯示，並支援分別勾選「已繳」豁免。
_Avoid_: 自動繳卡 (auto repayment)、漏計未出帳金額 (omitting unbilled debt in schedule)、已出帳與未出帳強行合併同日扣繳 (forcing billed and unbilled onto the same due date)

**Credit Card Recurring Cash Flow Shift (信用卡週期收支繳款日平移)**:
在未來 60 天現金流預測中，凡設定由信用卡扣款之週期收支項目，其真實現金資產流出日不再發生於刷卡記帳日（day_of_cycle），而是依據該信用卡之結帳日與繳款日精準平移至對應之「信用卡繳款日（Payment Due Day）」，時間軸保留週期項目獨立卡片並標記卡片與繳款日扣款，真實反映流動性到期責任並支援「已繳」單筆豁免。
_Avoid_: 刷卡日直接扣款 (immediate swipe cash deduction)、粗暴合併繳卡費 (opaque card merge)

**Settled Forecast Event (已繳預測事件)**:
未來 60 天現金流預測排程中，已被使用者勾選標記為「已繳」（搭配 `CheckCircle2` / `Circle` 向量圖示）之單次排程事件（涵蓋週期支出、週期收入與已出帳／未出帳繳卡費，以 `項目 ID + 預計日期 YYYY-MM-DD` 唯一識別）。當一筆事件已經實際刷卡入帳（進入信用卡未出帳）或已提前消費扣款時，勾選「已繳」即可將該次事件從 60 天現金流折線圖與購買力試算中豁免（不列入計算，防止重複扣款），並在排程清單中保留顯示為半透明刪除線狀態，支援隨時取消勾選恢復計算。
_Avoid_: 刪除排程 (delete schedule)、永久停用 (permanent disable)

**Savings Goal (儲蓄目標)**:
使用者設定具有目標總額與預計達成日的專項資產目標，其每月提撥額實質鎖定可支配現金。目標圖示採用 12 款預設 Lucide 向量 SVG 圖示選擇器（將圖示代號存入 `emoji` 欄位，並對既有資料庫中舊有 Emoji 字串自動向後相容轉譯為對應 SVG 圖示）。
_Avoid_: 存錢筒 (piggy bank)、夢想基金 (fund target)、願望 (wish)、直接渲染生文字 Emoji (raw emoji rendering)

**Budget (預算額度)**:
針對特定月份與特定消費類別所設定之支出上限，並具備即時預警監控。
_Avoid_: 額度 (spending limit)、花費上限 (cap)、配額 (allowance)

**Affordability Check (購買力試算)**:
使用者面臨大額消費前，隨當前所選視角（全部 / 公帳 / 私帳）即時試算扣除該筆開銷並模擬未來 60 天該視角週期收支與各期繳卡費後，是否會發生透支或擠壓儲蓄目標預留款的安全檢查。在「公帳」視角下，專注檢核共同基金是否透支，嚴格隔離成員個人私密儲蓄目標。
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

### 前端視覺主題與載入體驗 (Frontend Theme & Loading UX)

**Dual-Theme Color System (雙主題視覺色票系統：柔和水彩淺色 ＆ 月影鈦銀灰深色)**:
全站支援透過單一「淺色 ☀️ / 深色 🌙」切換鈕即時切換雙主題：
1. **淺色模式（`:root` — Soft Watercolor 柔和水彩日系）**：以溫暖櫻花粉白（`--bg-page: #FFF5F5`）、純白卡片（`--bg-surface: #FFFFFF`）、柔霧次表面（`--bg-surface-2: #FFF8F8`）與櫻花粉邊框（`--border-color: #FFDEDE`）為基底，搭配珊瑚粉主色（`--color-primary: #FF8A8A`）與水彩藍點綴（`--color-accent: #A8D8EA`）。
2. **深色模式（`[data-theme="dark"]` — Moonlit Titanium Dimmed 月影鈦銀灰）**：採用柔霧中明度鈦銀藍灰三階表面（`--bg-page: #181B20`、`--bg-surface: #22272E`、`--bg-surface-2: #2D333B`），不走死黑高反差以消除夜間文字光暈（Halation），並統一收斂單一中性石板邊框（`--border-color: #373E47`、`--border-color-2: #2D333B`，徹底移除重複覆寫之半透明粉紅邊框）、高辨識度文字階層（`--text-primary: #ECF2F8`、`--text-secondary: #9EA7B3`、`--text-muted: #6E7785`）、溫潤櫻花粉主色（`--color-primary: #FF9494`、`--color-primary-light: #FFB8B8`、`--color-primary-dark: #E67A7A`）以及深色語意收支色（`--color-success: #56D39A`、`--color-danger: #FF7B7B`、`--color-warning: #F7B955`），使日夜主題切換兼具空氣感與高對比易讀性。
_Avoid_: 高彩度刺眼藍紫深色底 (`#1A1A2E` / `#252540`)、純黑高反差眩光 (`#000000`)、深色模式下重複定義覆寫之粉紅邊框 (`rgba(255, 158, 158, 0.15)`)

**Skeleton Screen (骨架屏)**:
在非同步資料載入完成前，呈現與真實頁面結構（含行動端 RWD 斷點佈局）1:1 對齊的微光佔位區塊，用於防止版面跳動 (CLS) 並提供流暢的等待視覺回饋。所有骨架卡片統一沿用響應式標準內距（嚴禁寫死行內大內距），圓形圖示佔位固定比例不壓縮變形（`flex-shrink: 0`），文字與矩形佔位條具備彈性百分比／最大寬度防溢出保護（`max-width: 100%` 與 `min-width: 0`），並於行動端同步對齊三態等寬切換列、可收合篩選列與家庭成員名冊等真實區塊結構。
_Avoid_: 載入轉圈 (spinner)、空白佔位 (blank placeholder)、假資料 (mock data)、寫死固定像素寬度導致手機版擠壓溢出 (hardcoded pixel widths overflowing mobile cards)、圓形骨架壓縮成橢圓 (squished oval circle skeletons)

**Initial Mount Loading (初次載入狀態)**:
使用者首次進入頁面或完全重新整理時，在所有初始資料請求完成前呈現全頁骨架屏的狀態。
_Avoid_: 全頁轉圈 (page loading)、冷啟動 (cold start)

**Inline Refetch Transition (二度篩選過渡狀態)**:
頁面已完成初次載入後，使用者在同頁面進行篩選條件（如公私帳切換、月份切換）變更時，保留當前視圖並以輕量局部過渡（或半透明微光）更新資料的狀態，避免全頁閃爍。
_Avoid_: 二次骨架 (secondary skeleton)、重新載入 (reload)

**Shimmer Effect (微光動效 / 溫暖水彩果凍玻璃)**:
骨架屏融合 135 度櫻粉微暖雙漸層底色、毛玻璃通透感 (blur 5px) 與雙峰果凍高光波紋自左至右循環流動的 CSS 動態效果，容器本體維持絕對座標固定，並於深色模式下對齊「月影鈦銀灰」基底與微光邊框。
_Avoid_: 容器位移 (element translation)、生硬刷光 (hard sweep)、呼吸燈 (pulse)、跑馬燈 (marquee)、冷硬死灰 (cold dead grey)

---

### 行動端優先與響應式體驗 (Mobile-First RWD & UX)

**Mobile Bottom Sheet (行動端底部抽屜彈窗)**:
在行動端小螢幕（`<= 640px`）下，所有新增與編輯表單彈窗（`.modal-box`）由螢幕置中轉化為貼齊螢幕底部向上滑出之抽屜式面板（頂部大圓角、適配動態視窗高度 `dvh` 與底部安全區 `safe-area-inset-bottom`）。標題列吸頂固定並提供至少 `44x44px` 之關閉觸控熱區，表單輸入框字級不小於 `16px` 以防止 iOS Safari 強制放大畫面，並針對窄螢幕自動將易擠壓之並排欄位（如日期選擇器）調整為單欄滿寬，同時保留二選一歸屬切換鈕（如公帳／私帳）之水平雙欄並排。
_Avoid_: 手機置中懸浮彈窗 (centered floating modal on mobile)、低於 16px 觸發強制縮放之輸入框 (sub-16px auto-zoom inputs)、誤將二元切換鈕垂直拆行 (stacked binary toggle buttons)

**Collapsible Mobile Filter Bar (行動端可收合進階篩選列)**:
在收支明細頁（Transactions）的行動端視角（`<= 640px`）下，篩選工具列預設僅常駐顯示「三態帳本視角等寬切換器」、「關鍵字搜尋框」與附帶已啟用篩選數徽章之「進階篩選收合按鈕」，將起始／結束日期、收支類型、分類、帳戶等次要篩選條件預設折疊收合（展開時日期採雙欄並排），並將篩選結果統計列之「總收入、總支出、淨收支」轉為三欄等寬網格，確保使用者進入頁面第一屏即可直接檢視收支明細。
_Avoid_: 手機首屏全展開篩選牆 (full-screen uncollapsed filter wall)、篩選總計文字擠壓斷行 (cramped summary text wrapping)

**Two-Deck Mobile Transaction Row (手機版收支明細列雙層防誤觸排版)**:
在行動端小螢幕（`<= 640px`）下，單筆收支明細列（`TransactionRow`）將金額固定靠右上對齊，讓左側分類圖示與中間「分類・備註・徽章・帳戶」享有完整水平寬度；當該列包含操作按鈕（編輯、刪除或系統保護標籤）時，操作區自動獨立下移靠右排列並放大按鈕觸控熱區與安全間距，防止備註擠壓成細長多行及手指誤觸刪除。
_Avoid_: 單行硬塞金額與微型編刪鈕 (single-line cramming with tiny action icons)、緊貼誤刪風險 (adjacent micro delete button)

**Mobile Account Action Grid (手機版帳戶管理 2x2 快捷網格與觸控優化)**:
在帳戶管理頁（Accounts）的行動端視角（`<= 640px`）下，頂部四項核心操作（「ATM 提款／轉帳」、「新增現金錢包」、「新增銀行存款帳戶」、「新增信用卡」）自動排列為對齊之 `2x2` 雙欄等寬網格按鈕；帳戶卡片標題列維持名稱與編輯／刪除圖示（至少 `36x36px` 觸控盒）水平兩端對齊，且信用卡「未出帳」區之「校準」與「出帳作業」按鈕提供充足觸控高度與彈性換行空間。
_Avoid_: 頂部四鈕鋸齒狀折行堆疊 (jagged 4-button wrapping stack)、18px 微型校準按鈕 (micro 18px action buttons)

**Mobile Chart & Timeline Adaptation (手機版統計圖表與預測時間軸自適應)**:
在統計圖表頁（Analytics）與現金流預測頁（Forecast）的行動端視角（`<= 640px`）下，長條圖與折線圖之 X 軸自動啟用簡短月份／日期格式與防重疊跳格（`minTickGap`）；圓餅圖圖例於小螢幕改為單欄左右對齊列表以完整呈現分類名稱、百分比與金額；每月預算進度列與預測排程事件卡片皆轉為上下雙層結構，且預測時間軸解除固定高度內部捲軸限制，隨頁面自然滾動。
_Avoid_: 圖表 X 軸標籤重疊黑塊 (overlapping X-axis tick labels)、圓餅圖例雙欄截斷金額 (truncated 2-column pie legend)、手機局部捲軸陷阱 (nested scroll trapping)

**Mobile Advance Breakdown Card List (手機版家庭代墊與報銷雙層明細列)**:
在家庭協同頁（Family）的行動端視角（`<= 640px`）下，「代墊與報銷明細」與「共同基金撥款紀錄」捨棄固定最小寬度之四欄橫向捲動表格，轉化為免橫向滑動之上下雙層緊湊列（第一行左列類別與備註、右列金額；第二行左列日期、右列扣款或轉入帳戶）；代墊成員概覽之「累計公帳墊付」與「已獲撥款報銷」於窄螢幕自動上下分行並隱藏行間分隔圓點，操作按鈕採雙欄等寬並排。
_Avoid_: 手機版四欄強制橫向捲動表格 (horizontal-scroll 4-column table on mobile)、換行尾端殘留分隔圓點 (dangling separator dot on wrap)

**Mobile Household Roster & Anti-Cramming Layout (手機版家庭成員名冊與卡片防擠壓排版)**:
在行動端小螢幕（`<= 640px`）下，全站卡片統一遵循行動端緊湊內距（嚴禁以行內固定大內距覆蓋導致內容可用寬度受壓縮），並維持完整之間距與膠囊徽章色彩體系。家庭群組成員名冊單筆卡片採上下結構：頂部列由左側「圓形頭像＋姓名＋角色膠囊徽章」與右側「移除」操作鈕同行兩端對齊；底部資訊區之「電子信箱」與「加入時間」於手機版自動轉為上下獨立分行並隱藏中間分隔圓點；家庭頂部橫幅操作鈕則於手機版滿寬等寬並排。
_Avoid_: 頭像與文字零間距緊貼 (zero-gap avatar/text collision)、移除按鈕掉至左下角孤行 (orphaned bottom-left remove button)、行內固定大內距擠壓窄螢幕 (hardcoded inline padding squeezing mobile width)

**Mobile Segmented Scope & Quick-Add FAB (手機版等寬三態切換與全域懸浮記帳鈕)**:
在行動端視角（`<= 640px`）下，全站三態視角切換器（`ScopeTabBar`）自動轉為 100% 滿寬之三等分控制項（三個按鈕 `flex: 1` 置中均分，不附冗餘前綴文字）；各頁面頂部操作按鈕統一收斂於 `.header-actions` 容器以確保小螢幕滿寬對齊；同時於行動端右下角（底部導覽列上方安全區）提供水彩粉紅圓形「`+`」懸浮快速記帳按鈕（Quick-Add FAB），支援隨時一鍵喚起記帳表單。
_Avoid_: 手機版偏左不等寬三態按鈕 (left-aligned uneven scope tabs)、裸露未對齊之頂部操作鈕 (unwrapped header action buttons)

**Formula Breakdown Tooltip (統計公式透明化氣泡提示)**:
在全站所有統計數據儀表板卡片（總覽、帳戶管理、週期收支、儲蓄目標、現金流預測之 `.stat-card`）以及次要統計摘要區塊（收支明細篩選總計、統計分析消費總額與公帳分攤佔比、家庭協同代墊待報銷淨額）之指標標題旁，配置 `Info`（小 `i`）向量圖示按鈕。點擊時彈出自動防超出螢幕邊界之懸浮氣泡框（Popover Tooltip，點擊外部或再次點擊即收合，不撐開原卡片高度），框內分上下兩層同時呈現「會計計算公式定義」與「代入當前視角實際金額之驗算算式」，讓使用者能即時核對每一項統計指標的組成來源。
_Avoid_: 僅支援滑鼠懸停而手機無法觸發之原生 title (hover-only native title tooltip)、無實際數值代入之空泛文字 (static formula without live values)、超出手機螢幕右側邊界之氣泡框 (off-screen overflowing popover)
