# ADR 0045: 信用卡前期已結清帳單差額封存邊界與已出帳交易異動餘額同步 (Prior-Cycle Settled Statement Surplus Isolation and Billed Transaction Balance Synchronization)

## 狀態 (Status)
已接受 (Accepted) — 2026-11-19

## 背景與問題 (Context & Problem)
使用者執行信用卡「結帳日出帳作業」，在出帳預覽確認金額並送出後，卡片上的「已出帳待繳款總額 (`balance`)」與其中的「個人私帳待繳 (`billed_personal_debt`)」比預覽確認的金額少了 20 元（例如預覽確認出帳 `$X`，送出後 `balance` 卻變成 `$X - 20`，且減少的 20 元正好從私帳中扣除）。

經系統性根因診斷，問題來自以下兩個交互作用的會計邊界漏洞：

1. **`recalculateCardBalances` 全歷史終身加總未封存前期已結清差額**：
   - 當使用者於 `rollover-statement` 點擊「確認出帳」時，系統會將出帳前已發生、屬於前期帳單的信用卡還款流水標記封存為 `is_billed = 1`，而本期新出帳之明細則寫入 `is_billed = 1, billed_statement_date = statementDate`。
   - 然而，`recalculateCardBalances` 在計算 `newBalance` 時，卻將「創卡以來所有 `is_billed = 1` 的消費與刷退 (`billedExp - billedRef`)」減去「創卡以來所有的信用卡還款 (`billedRepay`)」。
   - 若前期已結清的歷史帳單中，曾因為使用者事後刪除、修改或移轉過某筆已出帳消費（或歷史還款多出 $20），使得前期 `歷史已封存還款 - 歷史已出帳消費 = +$20`（即 `baseNetBilled - priorRepay = -$20`），這筆 `-$20` 的歷史殘留差額未被前期結清邊界封存，而是在本期 `recalculateCardBalances` 時跨期偷扣了本期新出帳的 `balance`（使 `newBalance = netRolledAmount - 20`）。
   - 接著在 `computeCreditCardsReadOnlyMetrics`（ADR-0037）中，系統以當期帳單計算出公帳 `billed_shared_debt = stmtShared`，再以 `billed_personal_debt = Math.max(0, cardBalance - billed_shared_debt)` 計算私帳，導致 `cardBalance` 少掉的 20 元全數反映為「少了 20 元私帳」。

2. **編輯或刪除「已出帳 (`is_billed = 1`)」信用卡交易時未同步重算 `balance`**：
   - 在 `PUT /transactions/:id` 與 `DELETE /transactions/:id` 中，針對信用卡交易僅呼叫了 `reconcileCreditCardUnbilled`（只重算 `unbilled`），並未呼叫 `recalculateCardBalances` 更新 `balance`。
   - 這導致使用者在編輯或刪除已出帳交易、或將已出帳交易改勾選「延至下期」時，資料庫中的已出帳明細已經改變，但卡片的 `balance` 卻未同步更新，進而在歷史已出帳明細與歷史還款之間留下永久差額。

## 決策 (Decision)

1. **當期帳單 `balance` 獨立結算邊界（封存前期已結清歷史負差額）**：
   - 在 `recalculateCardBalances(db, cardId)` 中，與 ADR-0037 的 `computeCreditCardsReadOnlyMetrics` 對齊，區分「前期歷史已出帳區間」與「最新一期已出帳帳單 (`latest_stmt = MAX(billed_statement_date)`)」：
     - **前期歷史未結清餘額 (`priorUnpaid`)**：前期（`billed_statement_date < latest_stmt` 或無 `billed_statement_date`）之已出帳消費減刷退，扣除已封存之歷史還款（`is_billed = 1` 之信用卡還款）後，以 **`Math.max(0, priorNetBilled - sealedRepay)`** 夾零封存。前期若有負差額（歷史還款大於現存歷史已出帳明細），自動歸零封存，**嚴禁跨期折抵或偷扣當期新出帳之帳單金額**。
     - **當期帳單未結清餘額**：當期最新帳單淨額（`billed_statement_date = latest_stmt` 之已出帳消費減刷退）加上 `priorUnpaid`，再扣除當期未封存之有效還款（`is_billed = 0` 之信用卡還款 `amount - unbilled_offset`），得出精確之 `newBalance`。
   - 同步更新 `GET /accounts/:id/rollover-preview` 之 `projectedBalance` 公式：將前期未結清基準夾零為 `Math.max(0, baseNetBilled - sealedRepay)`，確保預覽確認金額與送出後之 `balance` 100% 一致。

2. **手動「校準」與「確認出帳」一鍵自癒修復**：
   - `POST /accounts/:id/reconcile`（手動校準）與 `POST /accounts/:id/rollover-statement`（確認出帳）均執行更新後的 `recalculateCardBalances`，讓現有因歷史差額而少 20 元私帳的卡片，只需點擊「校準」或重新「確認出帳」即可立即補回正確金額。

3. **編輯與刪除信用卡交易時同步重算 `balance` 與 `unbilled`**：
   - 在 `PUT /transactions/:id` 與 `DELETE /transactions/:id` 中，凡涉及信用卡帳戶（無論同卡修改金額／收支方向／延至下期狀態、跨帳戶移轉或刪除交易），除呼叫 `reconcileCreditCardUnbilled` 外，若該筆交易原為已出帳（`existing.is_billed === 1`）或涉及已出帳狀態變更，同步呼叫 `recalculateCardBalances`，確保 `balance` 與 `unbilled` 即時與底層明細保持一致。

## 後果 (Consequences)
- 徹底根除「前期已結清帳單因曾刪除／修改歷史消費或歷史溢繳差額，在下次出帳時偷扣當期已出帳總額與私帳金額」的 Bug。
- 出帳預覽顯示「確認出帳 `$X`（公 `$S` · 私 `$P`）」，送出後卡片即 100% 精準顯示「已出帳待繳款 `$X`（公 `$S` · 私 `$P`）」。
- 編輯或刪除已出帳信用卡交易時，卡片的已出帳待繳款與未出帳款同步精準更新，不再產生歷史差額殘留。
