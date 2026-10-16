import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatementCycleDates, determineEnrichedTransactionStates, calculateRolloverDebtBreakdown } from '../src/utils/cycle.ts';

test('Cycle Suite - 未到當期結帳日提前出帳 (Pre-Statement Rollover)', () => {
  // 今日 2026-10-16，結帳日 25 號 (未到結帳日提前結算)
  const result = getStatementCycleDates(25, null, new Date('2026-10-16T12:00:00+08:00'));
  assert.equal(result.prevStatementDate, '2026-09-25', '上期結帳日應為 2026-09-25');
  assert.equal(result.statementDate, '2026-10-25', '當期結帳日應為 2026-10-25');
  assert.equal(result.isPreStatement, true, '應判定為提前出帳 (isPreStatement = true)');
  assert.equal(result.preStatementDate, '2026-10-16', '提前出帳日期應為今日 2026-10-16');
});

test('Cycle Suite - 到達當期結帳日常態出帳 (Normal Rollover on Statement Day)', () => {
  // 今日 2026-10-25，結帳日 25 號 (已達結帳日)
  const result = getStatementCycleDates(25, null, new Date('2026-10-25T12:00:00+08:00'));
  assert.equal(result.prevStatementDate, '2026-09-25');
  assert.equal(result.statementDate, '2026-10-25');
  assert.equal(result.isPreStatement, false, '結帳日當天應為常態出帳 (isPreStatement = false)');
});

test('Cycle Suite - 前次出帳完成後推進至下一期 (Advance to Next Cycle after Rollover)', () => {
  // 今日 2026-10-28，結帳日 25 號，上次出帳為 2026-10-25
  const result = getStatementCycleDates(25, '2026-10-25 10:00:00', new Date('2026-10-28T12:00:00+08:00'));
  assert.equal(result.prevStatementDate, '2026-10-25', '上期結帳日應推進至 2026-10-25');
  assert.equal(result.statementDate, '2026-11-25', '當期結帳日應推進至 2026-11-25');
  assert.equal(result.isPreStatement, true, '尚未到 11/25，應為提前出帳預覽');
});

test('Cycle Suite - 上期延入款自動喚醒與當期消費納入 (Auto-Awakening of Prior Deferred Items)', () => {
  const statementDate = '2026-10-25';
  const prevStatementDate = '2026-09-25';

  const rawTxs = [
    {
      id: 'tx-prior-deferred',
      date: '2026-09-20', // 早於上期結帳日 9/25，且曾標記延至下期
      amount: 1200,
      defer_to_next_statement: 1,
      is_billed: 0,
    },
    {
      id: 'tx-current-normal',
      date: '2026-09-27', // 上期結帳日後消費
      amount: 2300,
      defer_to_next_statement: 0,
      is_billed: 0,
    },
    {
      id: 'tx-current-deferred',
      date: '2026-10-05', // 當期日常記帳時手動標記延至下期
      amount: 500,
      defer_to_next_statement: 1,
      is_billed: 0,
    }
  ];

  const enriched = determineEnrichedTransactionStates(rawTxs, statementDate, prevStatementDate, false);

  const priorItem = enriched.find(t => t.id === 'tx-prior-deferred');
  assert.equal(priorItem.is_prior_deferred, true, '9/20 消費應被識別為上期延入款');
  assert.equal(priorItem.is_initially_deferred, false, '上期延入款應自動喚醒，預設納入結算 (isInitiallyDeferred = false)');

  const currentNormal = enriched.find(t => t.id === 'tx-current-normal');
  assert.equal(currentNormal.is_initially_deferred, false, '當期常態消費應納入結算');

  const currentDeferred = enriched.find(t => t.id === 'tx-current-deferred');
  assert.equal(currentDeferred.is_prior_deferred, false, '當期新增消費非上期延入');
  assert.equal(currentDeferred.is_initially_deferred, true, '當期手動指定延期之消費應維持延至下期');
});

test('Cycle Suite - 卡片未設定結帳日情境 (Card without Statement Day)', () => {
  const rawTxs = [
    {
      id: 'tx-no-day-deferred',
      date: '2026-10-01',
      amount: 1000,
      defer_to_next_statement: 1,
      is_billed: 0,
    }
  ];

  // 未設定結帳日，首度出帳時延期項目亦應自動喚醒供使用者檢視出帳
  const enriched = determineEnrichedTransactionStates(rawTxs, '', '', false);
  const item = enriched.find(t => t.id === 'tx-no-day-deferred');
  assert.equal(item.is_initially_deferred, false, '未設定結帳日之卡片出帳時，未出帳項目應預設納入結算');
});

test('Cycle Suite - 出帳公私帳責任拆解與已報銷責任轉移 (ADR-0029)', () => {
  const activeTxs = [
    { amount: 1000, type: 'expense', is_shared: 0 }, // 個人私帳 $1000
    { amount: 2000, type: 'expense', is_shared: 1, reimbursement_id: null }, // 未報銷公帳代墊 $2000
    { amount: 1500, type: 'expense', is_shared: 1, reimbursement_id: 'reimb-123' }, // 已於家庭報銷之公帳代墊 $1500
    { amount: 300, type: 'income', is_shared: 1 }, // 公帳刷退 $300
    { amount: 200, type: 'income', is_shared: 0 }, // 個人私帳退款 $200
  ];

  const breakdown = calculateRolloverDebtBreakdown(activeTxs);

  // 總消費: 1000 + 2000 + 1500 = 4500
  assert.equal(breakdown.totalExpense, 4500, '總消費應為 4500');
  // 總刷退: 300 + 200 = 500
  assert.equal(breakdown.totalRefund, 500, '總刷退應為 500');
  // 總出帳淨額: 4500 - 500 = 4000
  assert.equal(breakdown.netRolledAmount, 4000, '總出帳淨額應為 4000');
  // 公帳欠款: 未報銷公帳 2000 - 公帳刷退 300 = 1700 (已報銷的 1500 不計入 sharedDebt)
  assert.equal(breakdown.sharedDebt, 1700, '未報銷公帳扣除刷退後公帳欠款應為 1700');
  // 個人欠款: 總出帳 4000 - 公帳欠款 1700 = 2300 (包含個人私帳淨額 800 + 已由家庭補償但需向銀行繳納的 1500)
  assert.equal(breakdown.personalDebt, 2300, '個人欠款應為 2300 (含已報銷公帳轉列個人)');
});

