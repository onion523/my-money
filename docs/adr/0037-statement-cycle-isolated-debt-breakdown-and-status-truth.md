# ADR 0037: 信用卡當期已出帳公私債務獨立結算邊界、真實出帳狀態判準統一與全額結清預設歸屬

## 狀態 (Status)
已接受 (Accepted) — 2026-11-08

## 背景與問題 (Context & Problem)
使用者於信用卡「結帳日出帳作業預覽」確認本期僅有 1 筆家庭代墊公帳消費 `$637`（個人私帳 `$0`），點擊「確認出帳 $637」後，帳戶卡片的「已出帳待繳款 $637」卻被拆成「`公 $375 · 私 $262`」（負債性質拆解亦顯示家庭代墊公帳 `$375`、個人私帳消費 `$262`）。

經追查根因有二：
1. **全歷史終身加總導致前期已結清差額跨期污染**：
   `computeCreditCardsReadOnlyMetrics` 原先將「創卡以來所有已出帳公帳消費 (`bil_exp_shared`)」減去「創卡以來所有標記為 `is_shared = 1` 的信用卡還款 (`bil_repay_shared`)」。當前期帳單曾使用「全額結清」（前端預設一律帶 `is_shared = 1`）或前期公帳消費事後於家庭協同完成報銷（`reimbursement_id` 寫入後依 ADR-0029 轉列私帳 `shared_eff = 0`，但歷史還款仍為 `is_shared = 1`）時，歷史 `bil_repay_shared` 會比歷史 `bil_exp_shared` 多出 `$262`。雖然前期帳單早已全數繳清（出帳前 `balance = 0`），但該筆 `-$262` 歷史差額卻跨期殘留，直接從本期新出帳之 `$637` 公帳中扣減 `$262`，導致 `billed_shared_debt = 375`、`billed_personal_debt = 637 - 375 = 262`。
2. **已出帳／未出帳判準雙軌分歧**：
   `recalculateCardBalances` 與 `rollover-statement` 以交易之 `is_billed` / `defer_to_next_statement` 與 `billed_statement_date` 為準，但 `computeCreditCardsReadOnlyMetrics` 卻以 `calculateCardCutoffDates` 日期切點推算 `unb`，在結帳日前後或跨兩期延後時可能與實際出帳狀態脫節。

## 決策 (Decision)
1. **統一以真實出帳標記 (`is_billed` / `defer_to_next_statement` / `billed_statement_date`) 為唯一判準**：
   - 未出帳交易定義統一為：`is_billed = 0 OR defer_to_next_statement = 1`。
   - 已出帳交易定義統一為：`is_billed = 1 AND defer_to_next_statement = 0`。
   - 確保 `GET /accounts`、`GET /accounts/balance`、`GET /forecast`、`GET /accounts/:id/rollover-preview` 與 `POST /accounts/:id/rollover-statement` 100% 同步。
2. **以「當期未結清帳單」為獨立公私拆解邊界，封存前期已結清歷史差額**：
   - 計算卡片已出帳公私拆解（`billed_shared_debt` / `billed_personal_debt`）時，以當期已出帳帳單（最新 `billed_statement_date` 週期及尚未結清之已出帳項目）之公帳淨額 `cycleSharedBilled` 與私帳淨額 `cyclePersonalBilled` 為基準。
   - 僅計入對應當期帳單（自上期結帳日後／當期帳單區間）之公私還款沖抵：公帳還款優先沖銷 `cycleSharedBilled`（溢出才沖銷私帳），私帳還款優先沖銷 `cyclePersonalBilled`（溢出才沖銷公帳）。
   - `billed_shared_debt` 與 `billed_personal_debt` 嚴格受當期未償公／私帳上限約束，且總和恆等於 `card.balance`。若當期帳單全數為公帳（`cyclePersonalBilled = 0`），則 `billed_personal_debt` 必為 `$0`，`billed_shared_debt = card.balance`。
3. **「全額結清」按鈕智慧預設歸屬**：
   - 點擊「全額結清」時，若卡片僅有私帳欠款（`shared_debt <= 0 && personal_debt > 0`）或所選預設扣款銀行為個人私帳（`is_joint === 0`），預設歸屬為 `is_shared = 0`（個人私帳還款）；若扣款銀行為家庭共同帳戶（`is_joint === 1`）或僅有公帳欠款，則預設為 `is_shared = 1`（家庭公帳還款）。

## 後果 (Consequences)
- 出帳預覽顯示「公 $637 · 私 $0」，確認出帳後卡片即精準顯示「公 $637 · 私 $0」，不再受歷史已結清帳單之還款標記或事後報銷影響。
- 全系統已出帳／未出帳與公私債務矩陣具備單一真實來源（Single Source of Truth）。
