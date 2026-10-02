# My-Money (個人與家庭雙帳本)

一套專為個人與伴侶／家庭設計的全方位現代記帳系統，涵蓋即時現金流、資產負債平衡、信用卡出帳管理、內部轉帳、家庭共同基金管理、週期收支平攤預測，以及 LINE / Telegram 對話式智慧記帳。

## Language

### 核心帳簿與總覽 (Core Ledger & Accounts)

**Transaction (交易記錄)**:
帳簿中記載特定日期的資金流入、流出或審計轉帳紀錄。
_Avoid_: 記帳紀錄 (entry)、流水帳 (log)、紀錄 (record)

**Transaction Balance Synchronization (交易餘額雙向連動)**:
在建立、編輯 (PUT) 或刪除 (DELETE) 交易時，系統必須嚴格維持交易金額與所屬資產帳戶餘額／信用卡未出帳金額的雙向即時同步。若交易編輯時變更所屬帳戶，舊帳戶必須全額回滾原交易金額，新帳戶則扣抵／認列新交易金額；若僅變更金額，則按差額補退；刪除交易時則全額回滾該帳戶之餘額或未出帳負債。
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
淨可用餘額進一步扣除當期週期收支分攤平滑預留與進行中儲蓄目標款項後的安全自由花費餘額。
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
從指定銀行存款扣款以償還信用卡欠款的內部轉帳程序，不會被重複計入生活消費支出。
_Avoid_: 繳卡費 (card payment)、清償 (debt clearance)、轉帳支出 (transfer expense)

**Statement Rollover (結帳日出帳作業)**:
結帳日到達後，使用者確認並將累積之未出帳金額一次性移轉合併至已出帳待繳款的結算程序，系統並記錄結轉時間點以作為下期未出帳之起算邊界。
_Avoid_: 帳單重算 (recalculation)、滾入下期 (carryover)、手動對帳 (manual reconciliation)、結轉 (rollover)

**Two-Tier Debt Rollback (雙層負債回退)**:
當編輯或刪除歷史刷卡消費交易時，負債回退程序優先扣減未出帳款（Unbilled Debt）；若未出帳款已不足扣（款項已於結帳日出帳作業中結轉至已出帳或已被還款沖銷），剩餘回退差額自動溢出扣減已出帳待繳款（Billed Debt），確保欠款全額精準返還。若為同帳戶編輯，應先計算新舊交易之單一淨差額（Single Net Delta）再行回退或認列，嚴禁分步覆蓋。
_Avoid_: 雙步覆蓋 (two-step overwrite)、夾零截斷 (zero clamping)、已出帳凍結 (billed freeze)

**Credit Card Balance Reconciliation (信用卡未出帳自動校準)**:
針對信用卡帳戶，使用者可一鍵自動依據當前掛在該卡底下、最後帳單結轉時間點之後的「有效消費支出 - 刷退收入 - 當期未出帳還款沖抵額（unbilled_offset）」，精準校準並覆蓋 unbilled 餘額，消除歷史落差並即刻復原公私帳刷卡分流（shared_debt 與 personal_debt）。
_Avoid_: 全額還款扣減 (full repayment deduction)、暴力重算 (hard reset)、人工對帳 (manual audit)

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

**Reimbursement (撥款請款報銷)**:
從家庭共同基金直接撥款轉帳至個人帳戶，以沖銷成員累積之家庭代墊款的平帳程序。
_Avoid_: 結算 (settlement)、退款 (refund)、還錢 (payback)

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

**Unified Ledger Scope (統一帳本範疇體系)**:
全站各頁面（Dashboard 總覽、Transactions 交易明細、Accounts 帳戶資產、Analytics 財務分析）在提供資料範圍過濾或切換檢視時，一律採用「全部 (all)」、「公帳 (household)」、「私帳 (personal)」三態結構，並固定搭配語意圖示：🌐 全部、🏠 公帳、🔒 私帳。全站徹底消除「全貌合併」、「家庭公用 (共同基金/家庭卡)」、「合併」等不一致用語。
_Avoid_: 全貌合併 (full merge)、檢視合併 (combined view)、家庭公用 (household common)

**All Scope (全部)**:
全站三態切換的首個選項（value: `all`，顯示「🌐 全部」），聚合呈現目前登入者之「個人私帳」以及家庭全體成員共用之「家庭公帳／共同基金」，提供全方位家庭財務與資產流水概覽。
_Avoid_: 全部 (本人 + 家庭公用) (all with verbose suffix)、全貌合併 (complete merge)、總體 (total)

**Shared Scope (公帳)**:
全站三態切換的第二個選項（value: `household`，顯示「🏠 公帳」），專注呈現標記為家庭公用之收支流水（`is_shared = 1`）、家庭共同基金帳戶（`is_joint = 1`）與共同信用卡，完全聚焦於家庭公共生活財務。
_Avoid_: 🏠 家庭公帳 (household shared)、🏠 家庭公用 (共同基金/家庭卡) (verbose household tag)

**Personal Scope (私帳)**:
全站三態切換的第三個選項（value: `personal`，顯示「🔒 私帳」），嚴格僅呈現登入者本人名下之個人私密收支（`is_shared = 0`）、個人現金皮夾、活存銀行存款與個人信用卡（`is_joint = 0`），徹底隔離家庭公帳與他人帳務。
_Avoid_: 👤 個人私帳 (personal account verbose)、🔒 個人私帳 (personal private)、私帳 (plain text without canonical icon)

**Modal Scope Toggle (記帳歸屬二態切換)**:
在快速記帳、新增交易、信用卡還款等表單彈窗（Modal）中，收支歸屬固定簡化正名為「🏠 公帳」與「🔒 私帳」二元切換按鈕，移除多餘之「(公開)」、「(隱私)」等括號贅詞。
_Avoid_: 🏠 家庭公帳 (公開) (verbose public)、🔒 個人私帳 (隱私) (verbose private)

---

### 交易分類體系 (Category Taxonomy)

**Curated Category Taxonomy (標準擴充分類庫)**:
系統內建定義之標準收支分類集合，覆蓋日常生活高頻場景，具備標準 Emoji 圖示、語意推薦關鍵字庫與統計圖表適配，不開放建立零碎自訂資料表以確保家庭成員在統計、預算與圓餅圖上擁有統一的分析維度。
_Avoid_: 自訂分類表 (custom category table)、動態標籤 (dynamic tags)、未分類 (unclassified)

**Standard Category Set (標準分類清單)**:
系統內建定義之標準收支分類集合，包含 16 項支出（餐飲 🍜、交通 🚇、汽機車輛 🚗、居家水電 ⚡、數位訂閱 📱、購物 🛍️、生活 💡、娛樂 🎮、美妝保養 💄、醫療 💊、教育 📚、寵物毛孩 🐱、旅行度假 ✈️、社交人情 🧧、保險稅費 📑、其他 📦）以及 8 項收入（薪資 💵、獎金 🎁、投資 📈、兼職 💼、政府補貼 🏛️、禮金餽贈 🧧、二手出清 ♻️、其他 📦）。
_Avoid_: 自由輸入類別 (freeform category)、舊版八大類 (legacy 8 categories)

**Two-Tier Category Recommendation (雙層分類推薦引擎)**:
在使用者輸入交易備註或通訊軟體自然語句時，自動推測最合適分類的雙層架構：第一層優先檢索個人/家庭近期歷史交易備註（Historical Note Memory），若有歷史同名或包含紀錄則優先採納個人既有習慣；第二層若無歷史紀錄，則落入內建生活語意關鍵字庫（Lexicon Fallback，涵蓋高頻品牌、交通、水電、訂閱、寵物等名詞）進行精準匹配。
_Avoid_: 純關鍵字暴力匹配 (hardcoded keyword matching only)、全盲隨機猜測 (blind guess)

**Adaptive Category Preselection (自適應分類預選與鎖定保護)**:
前端記帳表單在使用者鍵入交易備註或商家名稱時，即時調用雙層分類推薦引擎自動切換分類下拉選單並顯示「✨ 已智慧推薦為【類別】」柔和微光徽章。若使用者在該次填表中主動手動點選更換過分類，系統即刻啟動「選擇鎖定 (User Choice Lock)」，後續打字將嚴格保留使用者手動設定，杜絕反覆覆蓋干擾。
_Avoid_: 強迫覆蓋 (forced overwrite)、生硬彈窗 (intrusive popup)、無感靜默 (silent shift)

### 規劃與預測 (Planning & Forecasting)

**Recurring Item (週期收支)**:
按規律頻率（月、雙月、季、半年、年）固定重複發生的週期性收入或支出。
_Avoid_: 訂閱 (subscription)、固定支出 (fixed expense)、週期契約 (contract)

**Exact Recurring Schedule (確切週期繳費排程)**:
週期收支必須精確綁定執行月份與日期，包含月繳（每月天）、雙月繳（單數月/雙數月）、季繳（起算月 1/2/3 每季循環）、半年繳（起算月 1~6 每半年循環）與年繳（指定 1~12 月份）。在現金流預測中，遇大小月或二月天數不足時，一律自動平貼（clamp）至該月份最後一日完成扣款與模擬，嚴禁粗暴以月份倍數模除或跨月推遲。
_Avoid_: 模除猜測 (modulo guessing)、固定雙數月 (hardcoded even months)、跨月遞延 (month overflow drift)

**Amortization (分攤平滑)**:
將年繳、季繳等長週期大額支出平攤轉化為每月或每日的額度資金負擔之試算過程。
_Avoid_: 分期 (installment)、平滑化 (smoothing)、攤提 (proration)

**Savings Goal (儲蓄目標)**:
使用者設定具有目標總額與預計達成日的專項資產目標，其每月提撥額實質鎖定可支配現金。
_Avoid_: 存錢筒 (piggy bank)、夢想基金 (fund target)、願望 (wish)

**Budget (預算額度)**:
針對特定月份與特定消費類別所設定之支出上限，並具備即時預警監控。
_Avoid_: 額度 (spending limit)、花費上限 (cap)、配額 (allowance)

**Affordability Check (購買力試算)**:
使用者面臨大額消費前，即時試算扣除該筆開銷後可支配現金是否仍大於零的安全檢查。
_Avoid_: 購買模擬 (purchase simulation)、預算檢查 (budget check)、試算 (simulation)

---

### 機器人整合 (Bot Integration)

**Bot Binding (機器人綁定)**:
通訊軟體帳號（LINE 或 Telegram）與記帳使用者帳號透過專屬驗證碼建立之連結。
_Avoid_: 授權 (auth)、連線 (connection)、配對 (pairing)

**Natural Message (自然語言指令)**:
使用者於通訊聊天室輸入非結構化日常語句（例如：好市多 3200 公帳玉山），由系統解析為記帳交易。
_Avoid_: 聊天指令 (chat command)、提示詞 (prompt)、快速指令 (quick entry)

---

### 前端載入體驗與狀態 (Frontend Loading & UX State)

**Skeleton Screen (骨架屏)**:
在非同步資料載入完成前，呈現與真實頁面結構 1:1 佈局相仿的微光佔位區塊，用於防止版面跳動 (CLS) 並提供流暢的等待視覺回饋。
_Avoid_: 載入轉圈 (spinner)、空白佔位 (blank placeholder)、假資料 (mock data)

**Initial Mount Loading (初次載入狀態)**:
使用者首次進入頁面或完全重新整理時，在所有初始資料請求完成前呈現全頁骨架屏的狀態。
_Avoid_: 全頁轉圈 (page loading)、冷啟動 (cold start)

**Inline Refetch Transition (二度篩選過渡狀態)**:
頁面已完成初次載入後，使用者在同頁面進行篩選條件（如公私帳切換、月份切換）變更時，保留當前視圖並以輕量局部過渡（或半透明微光）更新資料的狀態，避免全頁閃爍。
_Avoid_: 二次骨架 (secondary skeleton)、重新載入 (reload)

**Shimmer Effect (微光動效 / 溫暖水彩果凍玻璃)**:
骨架屏融合 135 度櫻粉微暖雙漸層底色、毛玻璃通透感 (blur 5px) 與雙峰果凍高光波紋自左至右循環流動的 CSS 動態效果，容器本體維持絕對座標固定，適配淺色與深色主題。
_Avoid_: 容器位移 (element translation)、生硬刷光 (hard sweep)、呼吸燈 (pulse)、跑馬燈 (marquee)、冷硬死灰 (cold dead grey)
