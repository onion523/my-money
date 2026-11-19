import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, USER1, type Harness } from './harness';

/**
 * ADR 0037 / #189 / #190：
 * 驗證信用卡「出帳作業」後，當期已出帳待繳款之公私帳拆解 (billed_shared_debt / billed_personal_debt)
 * 以當期已出帳帳單為獨立結算邊界，不遭前期已結清帳單之「全額結清 (is_shared=1)」或「事後家庭報銷 (reimbursement_id)」
 * 產生的歷史公私還款差額跨期侵蝕。
 */
describe('ADR 0037: statement rollover debt breakdown isolation & status truth', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  async function createCard(statementDay: number, paymentDueDay: number): Promise<string> {
    const res = await h.request('/accounts', {
      method: 'POST',
      user: USER1,
      body: {
        name: `測試卡-${statementDay}`,
        type: 'credit_card',
        balance: 0,
        unbilled: 0,
        credit_limit: 150000,
        statement_day: statementDay,
        payment_due_day: paymentDueDay,
        payment_account_id: 'a_bank1',
        is_joint: 0,
      },
    });
    expect(res.status).toBe(201);
    return res.json.data.id as string;
  }

  async function createCardExpense(
    cardId: string,
    amount: number,
    date: string,
    isShared: number,
    note: string,
    deferToNextStatement = 0
  ): Promise<void> {
    const res = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '餐飲',
        amount,
        note,
        date,
        is_shared: isShared,
        defer_to_next_statement: deferToNextStatement,
      },
    });
    expect(res.status).toBe(201);
  }

  it('reproduces and fixes the $637 shared -> $375 shared / $262 personal bug after prior cycle full payment or reimbursement', async () => {
    // 1. 建立「國泰信用卡」(每月 7 號結帳、23 號繳款，個人私卡)
    vi.setSystemTime(new Date('2026-09-15T04:00:00Z'));
    const cardRes = await h.request('/accounts', {
      method: 'POST',
      user: USER1,
      body: {
        name: '國泰信用卡',
        type: 'credit_card',
        balance: 0,
        unbilled: 0,
        credit_limit: 150000,
        statement_day: 7,
        payment_due_day: 23,
        payment_account_id: 'a_bank1',
        is_joint: 0,
      },
    });
    expect(cardRes.status).toBe(201);
    const cardId = cardRes.json.data.id as string;

    // 2. 前期帳單 (2026-09-08 ~ 2026-10-07)：
    //    有一筆個人私帳 $262 (或已於家庭報銷之公帳 $262) 與一筆家庭公帳 $300，共 $562
    await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '餐飲',
        amount: 262,
        note: '前期個人消費',
        date: '2026-09-20',
        is_shared: 0,
      },
    });
    await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '日用品',
        amount: 300,
        note: '前期公帳消費',
        date: '2026-09-25',
        is_shared: 1,
      },
    });

    // 2026-10-08 執行前期出帳作業 -> balance = 562
    vi.setSystemTime(new Date('2026-10-08T04:00:00Z'));
    const roll1 = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(roll1.status).toBe(200);
    expect(roll1.json.data.balance).toBe(562);

    // 2026-10-20 使用者點擊「全額結清」(舊版前端預設 is_shared = 1 整筆還款 $562) -> balance 歸零
    vi.setSystemTime(new Date('2026-10-20T04:00:00Z'));
    const pay1 = await h.request('/accounts/pay-credit-card', {
      method: 'POST',
      user: USER1,
      body: {
        bank_account_id: 'a_bank1',
        credit_card_id: cardId,
        amount: 562,
        date: '2026-10-20',
        note: '扣繳【國泰信用卡】卡費 (全額)',
        is_shared: 1,
      },
    });
    expect(pay1.status).toBe(200);
    expect(pay1.json.data.card_balance).toBe(0);

    // 3. 本期帳單 (2026-10-08 ~ 2026-11-07)：僅有 1 筆公帳消費 $637 (2026-10-28 教育 蝦皮買書)
    vi.setSystemTime(new Date('2026-10-28T04:00:00Z'));
    const tx637 = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '教育',
        amount: 637,
        note: '蝦皮買書',
        date: '2026-10-28',
        is_shared: 1,
      },
    });
    expect(tx637.status).toBe(201);

    // 4. 2026-11-08 開啟「結帳日出帳作業預覽」：顯示本期出帳淨額 $637、公帳 $637、私帳 $0
    vi.setSystemTime(new Date('2026-11-08T00:27:00Z'));
    const previewRes = await h.request(`/accounts/${cardId}/rollover-preview`, { user: USER1 });
    expect(previewRes.status).toBe(200);
    expect(previewRes.json.data.netRolledAmount).toBe(637);
    expect(previewRes.json.data.sharedDebt).toBe(637);
    expect(previewRes.json.data.personalDebt).toBe(0);

    // 5. 點擊「確認出帳 $637」
    const roll2 = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(roll2.status).toBe(200);
    expect(roll2.json.data.balance).toBe(637);
    expect(roll2.json.data.unbilled).toBe(0);

    // 6. 出帳後讀取 GET /accounts：必須為 公 $637 · 私 $0（絕不可變成 公 $375 · 私 $262）
    const accsRes = await h.request('/accounts?scope=all', { user: USER1 });
    expect(accsRes.status).toBe(200);
    const cardAfter = accsRes.json.data.find((a: any) => a.id === cardId);
    expect(cardAfter).toBeDefined();
    expect(cardAfter.balance).toBe(637);
    expect(cardAfter.unbilled).toBe(0);
    expect(cardAfter.billed_shared_debt).toBe(637);
    expect(cardAfter.billed_personal_debt).toBe(0);
    expect(cardAfter.shared_debt).toBe(637);
    expect(cardAfter.personal_debt).toBe(0);

    // 7. 驗證 GET /accounts/balance 與 GET /forecast 對該卡負債拆解完全一致
    const balPersonal = await h.request('/accounts/balance?scope=personal', { user: USER1 });
    const balHousehold = await h.request('/accounts/balance?scope=household', { user: USER1 });
    expect(balPersonal.status).toBe(200);
    expect(balHousehold.status).toBe(200);

    const fcPersonal = await h.request('/forecast?scope=personal', { user: USER1 });
    const fcHousehold = await h.request('/forecast?scope=household', { user: USER1 });
    expect(fcPersonal.status).toBe(200);
    expect(fcHousehold.status).toBe(200);
    // 在 personal 視角下，該國泰信用卡私帳負債為 0，不應產生 262 的私帳卡費扣款預估
    const cathayPersonalEvents = (fcPersonal.json.data.events || []).filter((e: any) =>
      String(e.name || '').includes('國泰信用卡')
    );
    expect(cathayPersonalEvents.length).toBe(0);
    // 在 household 視角下，應有國泰信用卡公帳卡費 $637
    const cathayHouseholdEvents = (fcHousehold.json.data.events || []).filter((e: any) =>
      String(e.name || '').includes('國泰信用卡')
    );
    expect(cathayHouseholdEvents.length).toBe(1);
    expect(cathayHouseholdEvents[0].amount).toBe(637);
  });

  it('isolates prior cycle shared expense that was reimbursed via family center (reimbursement_id set) and supports accurate in-cycle bucket repayments', async () => {
    vi.setSystemTime(new Date('2026-09-15T04:00:00Z'));
    const cardRes = await h.request('/accounts', {
      method: 'POST',
      user: USER1,
      body: {
        name: '測試公私分流卡',
        type: 'credit_card',
        balance: 0,
        unbilled: 0,
        credit_limit: 100000,
        statement_day: 7,
        payment_due_day: 23,
        payment_account_id: 'a_bank1',
        is_joint: 0,
      },
    });
    const cardId = cardRes.json.data.id as string;

    // 前期一筆公帳 $262，出帳並以 is_shared=1 結清後，於家庭中心完成報銷 (寫入 reimbursement_id)
    const priorTx = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '家庭採買',
        amount: 262,
        note: '前期代墊後報銷',
        date: '2026-09-20',
        is_shared: 1,
      },
    });
    const priorTxId = priorTx.json.data.id as string;

    vi.setSystemTime(new Date('2026-10-08T04:00:00Z'));
    await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });

    // 模擬家庭中心報銷標記 reimbursement_id
    await h.db.prepare('UPDATE transactions SET reimbursement_id = ? WHERE id = ?').bind('reimb_prior_262', priorTxId).run();

    // 前期繳清 $262 (is_shared = 1)
    vi.setSystemTime(new Date('2026-10-20T04:00:00Z'));
    await h.request('/accounts/pay-credit-card', {
      method: 'POST',
      user: USER1,
      body: {
        bank_account_id: 'a_bank1',
        credit_card_id: cardId,
        amount: 262,
        date: '2026-10-20',
        note: '前期繳清',
        is_shared: 1,
      },
    });

    // 本期新增：公帳 $600 + 私帳 $400 = $1000
    vi.setSystemTime(new Date('2026-10-25T04:00:00Z'));
    await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '日用品',
        amount: 600,
        note: '本期公帳',
        date: '2026-10-25',
        is_shared: 1,
      },
    });
    await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '娛樂',
        amount: 400,
        note: '本期私帳',
        date: '2026-10-26',
        is_shared: 0,
      },
    });

    // 2026-11-08 出帳作業
    vi.setSystemTime(new Date('2026-11-08T04:00:00Z'));
    const rollRes = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(rollRes.status).toBe(200);
    expect(rollRes.json.data.balance).toBe(1000);

    // 出帳後應精準為 公 $600 · 私 $400（不受前期 $262 報銷影響）
    let accs = await h.request('/accounts?scope=all', { user: USER1 });
    let card = accs.json.data.find((a: any) => a.id === cardId);
    expect(card.billed_shared_debt).toBe(600);
    expect(card.billed_personal_debt).toBe(400);

    // 先繳納「個人私帳 ($400)」(is_shared = 0) -> 剩餘應為 公 $600 · 私 $0
    await h.request('/accounts/pay-credit-card', {
      method: 'POST',
      user: USER1,
      body: {
        bank_account_id: 'a_bank1',
        credit_card_id: cardId,
        amount: 400,
        date: '2026-11-10',
        note: '繳個人私帳',
        is_shared: 0,
      },
    });
    accs = await h.request('/accounts?scope=all', { user: USER1 });
    card = accs.json.data.find((a: any) => a.id === cardId);
    expect(card.balance).toBe(600);
    expect(card.billed_shared_debt).toBe(600);
    expect(card.billed_personal_debt).toBe(0);

    // 即使在同週期部分還款後再次點擊「出帳作業」(re-rollover)，仍應保留當期已沖抵還款之公私分流 (公 $600 · 私 $0)
    const reRollRes = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(reRollRes.status).toBe(200);
    accs = await h.request('/accounts?scope=all', { user: USER1 });
    card = accs.json.data.find((a: any) => a.id === cardId);
    expect(card.balance).toBe(600);
    expect(card.billed_shared_debt).toBe(600);
    expect(card.billed_personal_debt).toBe(0);

    // 再繳納「家庭代墊 ($600)」(is_shared = 1) -> 剩餘應為 公 $0 · 私 $0
    await h.request('/accounts/pay-credit-card', {
      method: 'POST',
      user: USER1,
      body: {
        bank_account_id: 'a_bankj',
        credit_card_id: cardId,
        amount: 600,
        date: '2026-11-12',
        note: '繳家庭代墊',
        is_shared: 1,
      },
    });
    accs = await h.request('/accounts?scope=all', { user: USER1 });
    card = accs.json.data.find((a: any) => a.id === cardId);
    expect(card.balance).toBe(0);
    expect(card.billed_shared_debt).toBe(0);
    expect(card.billed_personal_debt).toBe(0);
  });

  it('excludes non-deferred prior-cycle unbilled items from rollover-preview [上期延入] and settles them on rollover-statement', async () => {
    // 結帳日 15 號，今日 2026-11-15：本期區間 2026-10-16 ~ 2026-11-15，prevStatementDate = 2026-10-15
    vi.setSystemTime(new Date('2026-11-15T04:00:00Z'));
    const cardId = await createCard(15, 25);

    // 1. 9/12 歷史消費（早於 2026-10-15、未勾選延至下期 defer_to_next_statement = 0）
    await createCardExpense(cardId, 500, '2026-09-12', 0, '9/12未延期歷史消費', 0);
    // 2. 9/20 歷史消費（早於 2026-10-15、明確勾選延至下期 defer_to_next_statement = 1）
    await createCardExpense(cardId, 300, '2026-09-20', 0, '9/20真正上期延入', 1);
    // 3. 11/01 本期消費
    await createCardExpense(cardId, 1000, '2026-11-01', 0, '11/01本期消費', 0);

    // 開啟出帳預覽：不應出現 9/12（未延期），應僅出現 9/20（is_prior_deferred = true）與 11/01（本期）
    const previewRes = await h.request(`/accounts/${cardId}/rollover-preview`, { user: USER1 });
    expect(previewRes.status).toBe(200);
    const previewTxs = previewRes.json.data.transactions as Array<any>;
    expect(previewTxs.map(t => t.note)).toEqual(['11/01本期消費', '9/20真正上期延入']);
    expect(previewTxs.find(t => t.note === '9/20真正上期延入')?.is_prior_deferred).toBe(true);
    expect(previewRes.json.data.netRolledAmount).toBe(1300);
    expect(previewRes.json.data.projectedUnbilled).toBe(0);

    // 確認出帳：9/20 與 11/01 出帳（billed_statement_date = 2026-11-15），9/12 同步轉為 is_billed = 1（billed_statement_date = 2026-10-15）
    const rollRes = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(rollRes.status).toBe(200);
    expect(rollRes.json.data.balance).toBe(1800);
    expect(rollRes.json.data.unbilled).toBe(0);

    // 再次開啟出帳預覽：9/12 不可復活為 [上期延入]
    const previewAfter = await h.request(`/accounts/${cardId}/rollover-preview`, { user: USER1 });
    expect(previewAfter.status).toBe(200);
    const afterNotes = (previewAfter.json.data.transactions as Array<any>).map(t => t.note);
    expect(afterNotes).toEqual(['11/01本期消費', '9/20真正上期延入']);
  });

  it('POST /accounts/:id/reconcile marks non-deferred prior-cycle unbilled items as billed while preserving current cycle unbilled', async () => {
    vi.setSystemTime(new Date('2026-11-15T04:00:00Z'));
    const cardId = await createCard(15, 25);

    // 9/12 未延期歷史消費 + 11/01 本期未出帳消費
    await createCardExpense(cardId, 500, '2026-09-12', 0, '9/12未延期歷史消費', 0);
    await createCardExpense(cardId, 1000, '2026-11-01', 0, '11/01本期消費', 0);

    const recRes = await h.request(`/accounts/${cardId}/reconcile`, {
      method: 'POST',
      user: USER1,
    });
    expect(recRes.status).toBe(200);
    expect(recRes.json.data.balance).toBe(500);
    expect(recRes.json.data.unbilled).toBe(1000);
  });

  it('ADR 0045: does not deduct $20 personal debt from current rollover when a prior settled statement had a deleted $20 billed tx or $20 repayment surplus, and synchronizes balance on edit/delete of billed txs', async () => {
    // 1. 建立信用卡 (結帳日 15 號，繳款日 5 號)
    vi.setSystemTime(new Date('2026-10-01T04:00:00Z'));
    const cardId = await createCard(15, 5);

    // 2. 前期帳單 (2026-09-16 ~ 2026-10-15)：消費 $500 + $20 = $520
    const tx500Res = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '餐飲',
        amount: 500,
        note: '前期消費500',
        date: '2026-10-05',
        is_shared: 0,
      },
    });
    expect(tx500Res.status).toBe(201);
    const tx20Res = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '餐飲',
        amount: 20,
        note: '前期消費20',
        date: '2026-10-06',
        is_shared: 0,
      },
    });
    expect(tx20Res.status).toBe(201);
    const tx20Id = tx20Res.json.data.id as string;

    // 2026-10-16 前期出帳 -> balance = 520
    vi.setSystemTime(new Date('2026-10-16T04:00:00Z'));
    const rollPrior = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(rollPrior.status).toBe(200);
    expect(rollPrior.json.data.balance).toBe(520);

    // 2026-10-25 繳清前期帳單 $520 -> balance = 0
    vi.setSystemTime(new Date('2026-10-25T04:00:00Z'));
    const payPrior = await h.request('/accounts/pay-credit-card', {
      method: 'POST',
      user: USER1,
      body: {
        bank_account_id: 'a_bank1',
        credit_card_id: cardId,
        amount: 520,
        date: '2026-10-25',
        note: '繳清前期520',
        is_shared: 0,
      },
    });
    expect(payPrior.status).toBe(200);
    expect(payPrior.json.data.card_balance).toBe(0);

    // 使用者事後刪除了前期那筆 $20 的已出帳消費（導致歷史已出帳消費總和 500 < 歷史還款 520，產生 -20 差額）
    const delPrior20 = await h.request(`/transactions/${tx20Id}`, {
      method: 'DELETE',
      user: USER1,
    });
    expect(delPrior20.status).toBe(200);

    // 3. 本期帳單 (2026-10-16 ~ 2026-11-15)：公帳 $600 + 私帳 $400 = $1000
    vi.setSystemTime(new Date('2026-11-10T04:00:00Z'));
    await createCardExpense(cardId, 600, '2026-11-02', 1, '本期公帳600', 0);
    const curPersonalRes = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '購物',
        amount: 400,
        note: '本期私帳400',
        date: '2026-11-05',
        is_shared: 0,
      },
    });
    expect(curPersonalRes.status).toBe(201);
    const curPersonalId = curPersonalRes.json.data.id as string;

    // 4. 2026-11-19 開啟出帳預覽：確認出帳金額為 $1000（公 $600 · 私 $400），projectedBalance 亦為 $1000
    vi.setSystemTime(new Date('2026-11-19T04:00:00Z'));
    const preview = await h.request(`/accounts/${cardId}/rollover-preview`, { user: USER1 });
    expect(preview.status).toBe(200);
    expect(preview.json.data.netRolledAmount).toBe(1000);
    expect(preview.json.data.sharedDebt).toBe(600);
    expect(preview.json.data.personalDebt).toBe(400);
    expect(preview.json.data.projectedBalance).toBe(1000);

    // 5. 點擊「確認出帳」送出後：balance 必須為 $1000（絕不可少 20 元變成 $980），且私帳必須為 $400（絕不可少 20 元變成 $380）
    const rollCurr = await h.request(`/accounts/${cardId}/rollover-statement`, {
      method: 'POST',
      user: USER1,
      body: { deferredTxIds: [] },
    });
    expect(rollCurr.status).toBe(200);
    expect(rollCurr.json.data.balance).toBe(1000);

    let accsRes = await h.request('/accounts?scope=all', { user: USER1 });
    let cardAfter = accsRes.json.data.find((a: any) => a.id === cardId);
    expect(cardAfter.balance).toBe(1000);
    expect(cardAfter.billed_shared_debt).toBe(600);
    expect(cardAfter.billed_personal_debt).toBe(400);

    // 6. 模擬資料庫先前已因舊版邏輯寫入錯誤的 balance = 980，點擊「校準」應自動自癒補回 $1000（公 $600 · 私 $400）
    await h.db.prepare('UPDATE accounts SET balance = 980 WHERE id = ?').bind(cardId).run();
    const recRes = await h.request(`/accounts/${cardId}/reconcile`, {
      method: 'POST',
      user: USER1,
    });
    expect(recRes.status).toBe(200);
    expect(recRes.json.data.balance).toBe(1000);

    accsRes = await h.request('/accounts?scope=all', { user: USER1 });
    cardAfter = accsRes.json.data.find((a: any) => a.id === cardId);
    expect(cardAfter.balance).toBe(1000);
    expect(cardAfter.billed_shared_debt).toBe(600);
    expect(cardAfter.billed_personal_debt).toBe(400);

    // 7. 編輯已出帳（is_billed = 1）之本期私帳消費 $400 -> $450，balance 應即時同步為 $1050（公 $600 · 私 $450）
    const editBilledRes = await h.request(`/transactions/${curPersonalId}`, {
      method: 'PUT',
      user: USER1,
      body: {
        account_id: cardId,
        type: 'expense',
        category: '購物',
        amount: 450,
        note: '本期私帳450',
        date: '2026-11-05',
        is_shared: 0,
      },
    });
    expect(editBilledRes.status).toBe(200);
    accsRes = await h.request('/accounts?scope=all', { user: USER1 });
    cardAfter = accsRes.json.data.find((a: any) => a.id === cardId);
    expect(cardAfter.balance).toBe(1050);
    expect(cardAfter.billed_shared_debt).toBe(600);
    expect(cardAfter.billed_personal_debt).toBe(450);

    // 8. 刪除該筆已出帳私帳消費 $450，balance 應即時同步為 $600（公 $600 · 私 $0）
    const delBilledRes = await h.request(`/transactions/${curPersonalId}`, {
      method: 'DELETE',
      user: USER1,
    });
    expect(delBilledRes.status).toBe(200);
    accsRes = await h.request('/accounts?scope=all', { user: USER1 });
    cardAfter = accsRes.json.data.find((a: any) => a.id === cardId);
    expect(cardAfter.balance).toBe(600);
    expect(cardAfter.billed_shared_debt).toBe(600);
    expect(cardAfter.billed_personal_debt).toBe(0);
  });
});
