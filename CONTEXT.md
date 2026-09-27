# My-Money (個人與家庭記帳本)

一個專為個人與伴侶/家庭設計的全方位現代記帳系統，涵蓋即時資產負債平衡、信用卡代墊與內部沖銷、家庭共同基金管理、週期性支出月攤提，以及 LINE / Telegram 對話式智慧記帳。

## Language

### 核心帳務與總帳 (Core Ledger & Accounts)

**Transaction (交易紀錄)**:
單筆發生於特定日期的資金流入或流出審計紀錄。
_Avoid_: 記帳紀錄 (entry)、流水號 (log)、流水 (record)

**Account (資金帳戶)**:
存放資金或記錄負債的實體或數位載體，劃分為活存銀行帳戶或信用卡帳戶。
_Avoid_: 錢包 (wallet)、卡片 (card)、總帳 (ledger)

**Bank Account (銀行存款帳戶)**:
代表現金、活期存款或數位帳戶之正資產帳戶。
_Avoid_: 現金帳戶 (cash account)、活存帳戶 (deposit account)

**Credit Card (信用卡帳戶)**:
代表發卡銀行授予之循環信用額度與負債帳戶。
_Avoid_: 負債帳戶 (debt account)、卡片 (card)

**Available Balance (淨可用資產)**:
所有活存銀行存款總和扣除所有信用卡總欠款（已出帳加未出帳）後之實質淨流動資金。
_Avoid_: 淨資產 (net worth)、可用額度 (credit limit)、總餘額 (total balance)

**Disposable Cash (真實可支配現金)**:
淨可用資產進一步扣除當月固定支出攤提預留額與進行中儲蓄目標預留額後，手頭可自由花費之現金。
_Avoid_: 零用錢 (pocket money)、多餘資金 (free cash)、閒置資金 (idle cash)

---

### 信用卡帳務與結算 (Credit Card Debt & Settlement)

**Billed Debt (已出帳待繳金額)**:
發卡銀行已完成結帳並列於帳單上、必須於繳款日前繳納之確定負債。
_Avoid_: 帳單金額 (statement balance)、本期應繳 (invoice)、應繳款 (current bill)

**Unbilled Debt (未出帳金額)**:
於最近一次結帳日後刷卡產生、尚未列入正式帳單之即時累計消費負債。
_Avoid_: 浮動欠款 (floating debt)、未入帳 (pending charges)、暫估款 (accrued)

**Statement Day (結帳日)**:
發卡機構每月切齊未出帳消費並產出帳單之固定每月日期。
_Avoid_: 出帳日 (closing date)、切帳日 (cut-off date)、計費週期 (billing cycle)

**Payment Due Day (繳款日)**:
持卡人必須繳清本期已出帳待繳金額以免產生循環利息之最後繳納期限日。
_Avoid_: 到期日 (due date)、繳納日 (payment date)、截止日 (deadline)

**Credit Card Repayment (信用卡還款沖銷)**:
自指定銀行存款扣款以抵減信用卡負債之內部轉帳程序，不會被重複計入生活消費支出。
_Avoid_: 繳卡費 (card payment)、清償 (debt clearance)、轉帳支出 (transfer expense)

**Statement Rollover (結帳日出帳結轉)**:
於結帳日到達後，由使用者確認並將累積之未出帳金額一次性移轉合併至已出帳待繳之結轉程序。
_Avoid_: 帳單重算 (recalculation)、轉出帳 (carryover)、手動對帳 (manual reconciliation)

---

### 家庭公帳與共同基金 (Household & Joint Fund)

**Household (家庭群組)**:
由多位使用者組成、能共享家庭公帳收支並檢視協同財務數據之關聯組織。
_Avoid_: 團隊 (team)、群組 (group)、家族 (family)

**Shared Expense (家庭公帳)**:
為家庭全體利益或共同生活所產生、標記為全體成員共享之消費支出。
_Avoid_: 共同開銷 (joint expense)、公款 (public cost)、公費 (group cost)

**Personal Expense (個人私帳)**:
僅供家庭中個別成員個人享受、與家庭共同生活無關之私有支出。
_Avoid_: 私帳 (private expense)、個人支出 (self expense)、自付額 (own cost)

**Joint Fund (家庭共同基金)**:
標記為家庭公用之特定銀行帳戶，由成員定期定額注入，專門用於支付公帳採買與撥付代墊款報銷。
_Avoid_: 公費池 (common pool)、家庭帳戶 (family account)、公款 (public fund)

**Advanced Payment (公帳代墊款)**:
由個別成員先以個人信用卡或自有現金為家庭公帳墊付之代收款項。
_Avoid_: 先墊 (upfront pay)、個人借支 (loan to family)、代付款 (advance)

**Reimbursement (代墊請款報銷)**:
自家庭共同基金直接撥款轉帳至個人帳戶，以沖銷成員先前為家庭代墊款項之平帳動作。
_Avoid_: 結清 (settlement)、退款 (refund)、還錢 (payback)

---

### 規劃與預測 (Planning & Forecasting)

**Recurring Item (固定收支)**:
具有規律週期性（月、雙月、季、半年、年）且需定期支付或領取之合約性收支項目。
_Avoid_: 訂閱 (subscription)、定額支出 (fixed expense)、週期合約 (contract)

**Amortization (週期攤提)**:
將年繳、季繳等長週期固定支出平攤轉化為每月應當預留之月度資金負擔之計算過程。
_Avoid_: 分期 (installment)、平滑化 (smoothing)、預提 (proration)

**Savings Goal (儲蓄目標)**:
使用者設定具有目標總額與預計達成日之專案資產儲備，其每月預留額會實質鎖定可支配現金。
_Avoid_: 存錢罐 (piggy bank)、夢想基金 (fund target)、願望 (wish)

**Budget (分類預算)**:
針對特定月份與特定消費類別所設定之支出上限，並具備超支預警監控。
_Avoid_: 額度 (spending limit)、花費限制 (cap)、限額 (allowance)

**Affordability Check (購買力試算)**:
在使用者動用大額消費前，即時驗算扣除該筆開銷後可支配現金是否仍大於零之安全檢查。
_Avoid_: 購買模擬 (purchase simulation)、預算檢查 (budget check)、試算 (simulation)

---

### 機器人記帳 (Bot Integration)

**Bot Binding (機器人綁定)**:
通訊軟體帳號（LINE 或 Telegram）與記帳本使用者帳戶間透過專屬驗證碼建立之關聯。
_Avoid_: 授權 (auth)、連線 (connection)、配對 (pairing)

**Natural Message (自然語意指令)**:
使用者於通訊聊天室輸入之非結構化日常語句（如「好市多 3200 公帳」），由解析器轉譯為記帳交易。
_Avoid_: 聊天指令 (chat command)、提示詞 (prompt)、快捷記帳 (quick entry)
