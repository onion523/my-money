# My-Money (個人與家庭雙帳本)

一套專為個人與伴侶／家庭設計的全方位現代記帳系統，涵蓋即時現金流、資產負債平衡、信用卡出帳管理、內部轉帳、家庭共同基金管理、週期收支平攤預測，以及 LINE / Telegram 對話式智慧記帳。

## Language

### 核心帳簿與總覽 (Core Ledger & Accounts)

**Transaction (交易記錄)**:
帳簿中記載特定日期的資金流入、流出或審計轉帳紀錄。
_Avoid_: 記帳紀錄 (entry)、流水帳 (log)、紀錄 (record)

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
淨可用餘額進一步扣除當期固定收支平攤預留與進行中儲蓄目標款項後的安全自由花費餘額。
_Avoid_: 零用錢 (pocket money)、空閒餘額 (free cash)、閒置資金 (idle cash)

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
結帳日到達後，使用者確認並將累積之未出帳金額一次性移轉合併至已出帳待繳款的結算程序。
_Avoid_: 帳單重算 (recalculation)、滾入下期 (carryover)、手動對帳 (manual reconciliation)

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

**Joint Fund (家庭共同基金)**:
標記為家庭公帳專用之銀行帳戶或公款現金，成員定額注資，專門用於家庭公帳買單或撥付代墊款報銷。
_Avoid_: 公費池 (common pool)、家庭帳戶 (family account)、公款 (public fund)

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

---

### 規劃與預測 (Planning & Forecasting)

**Recurring Item (週期收支)**:
按規律頻率（月、雙月、季、半年、年）固定重複發生的週期性收入或支出。
_Avoid_: 訂閱 (subscription)、固定支出 (fixed expense)、週期契約 (contract)

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

**Shimmer Effect (微光動效)**:
骨架屏表面以 45 度線形漸變高光自左至右循環流動的 CSS 動態效果，適配淺色與深色主題。
_Avoid_: 呼吸燈 (pulse)、跑馬燈 (marquee)
