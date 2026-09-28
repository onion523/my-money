# 0006. 信用卡帳務週期生命週期、雙層負債回退與全站領域正名對齊 (Credit Card Accounting Lifecycle, Two-Tier Debt Rollback, and Terminology Alignment)

## Context
針對 iOS 端對照 `b5cbe09` 整理提出的 4 大結構性缺陷（GitHub Issue #19）：
1. **未出帳自動校準重複計算**：`POST /accounts/:id/reconcile` 以「上一個結帳日之後」重算，但結轉與還款未記錄時間點或沖帳流水，導致結轉／還款後校準時，已出帳與已繳消費被重複加總進未出帳。
2. **交易回沖夾零與非原子異動**：`syncAccountBalance` 回沖信用卡時以 `MAX(0, unbilled + delta)` 截斷，若消費已結轉至已出帳 (`balance`)，未出帳歸零後多餘回沖差額直接消失，導致欠款未退；且 `PUT` / `DELETE` 先更動帳戶再改交易，缺乏原子批次事務保證。
3. **報銷撥款帳戶未過濾信用卡**：家庭報銷中心僅收款帳戶脫敏過濾，撥款帳戶下拉選單與後端端點仍可選擇與傳入家庭信用卡。
4. **Web 畫面用字與 CONTEXT.md 不一致**：大量使用 `_Avoid_` 禁忌詞彙（皮夾、公款、固定支出、攤提、夢想基金、配對碼、結轉等），同概念混用多種叫法。

## Decision
1. **雙層負債溢出回退 (Two-Tier Debt Rollback)**：
   - 編輯或刪除信用卡交易進行負債回退時，優先自未出帳 (`unbilled`) 扣減。
   - 若未出帳不足扣減（表示該筆交易款項已在結帳日出帳作業中滾入已出帳或已被還款沖銷），剩餘溢出差額自動自已出帳待繳款 (`balance`) 扣除：`balance = MAX(0, balance - remainder)`。徹底杜絕夾零殘留已出帳欠款。
2. **信用卡結轉時間戳與還款雙向流水追蹤**：
   - `accounts` 表新增 `last_rollover_at DATETIME` 欄位，記錄最後一次結帳日出帳作業的時間點。
   - `POST /accounts/pay-credit-card` 還款作業時，除了於扣款銀行記錄支出外，同步於該信用卡建立「信用卡還款」類別之沖帳紀錄。
   - `POST /accounts/:id/reconcile` 校準口徑：以 `last_rollover_at` 之後的所有有效刷卡支出，扣除刷退收入與當期未出帳還款沖抵額，精準重算 `unbilled`。
3. **Cloudflare D1 原子性批次操作**：
   - `PUT /transactions/:id` 與 `DELETE /transactions/:id` 之帳戶餘額更新與交易紀錄異動，全面使用 `db.batch([...])` 包裝，確保資料庫層級之強一致性與失敗原子回滾。
4. **家庭公帳報銷撥款與收款帳戶型別強制防護**：
   - 後端 `POST /households/reimburse` 強制校驗撥款帳戶 (`fromAccount`) 與收款帳戶 (`toAccount`) 皆為 `type IN ('bank', 'cash')`，且撥款帳戶必須 `is_joint = 1`。
   - 前端 `Family.tsx` 撥款下拉選單嚴格過濾，僅列出 `is_joint === 1 && (type === 'bank' || type === 'cash')`。
5. **全站 Web 畫面與後端訊息 100% 嚴格對齊 CONTEXT.md 正名**：
   - 全面替換為「淨可用餘額」、「真實可支配現金」、「現金錢包」、「銀行存款帳戶」、「資產帳戶」、「繳款日」、「信用卡扣款還款」、「結帳日出帳作業」、「家庭群組」、「家庭公帳」、「個人私帳」、「家庭共同基金」、「週期收支」、「分攤平滑」、「儲蓄目標」、「購買力試算」、「機器人綁定」、「交易記錄」，根除所有 `_Avoid_` 詞彙。

## Consequences
- 結轉或還款後隨時點擊自動校準皆能得到精確未出帳，不再產生虛增欠款。
- 歷史交易無論何時刪除或改小金額，均能透過雙層回退完整返還卡債。
- 資料庫異動達到事務原子性，杜絕網路中斷導致的帳戶與交易不一致。
- 家庭報銷流程杜絕信用卡錯誤扣款與負債誤沖。
- Web 與 iOS 端達成一致的領域語言與用戶體驗。
