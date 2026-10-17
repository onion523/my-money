import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatementCycleDates, determineEnrichedTransactionStates, calculateRolloverDebtBreakdown } from '../src/utils/cycle.ts';

test('Cycle Suite - 未到當期結帳日結算區間 (ADR-0030: currDay < statementDay)', () => {
  // 今日 2026-10-17，結帳日 25 號 (未到 25 號)
  // 上期為 2026-09-25，上上期為 2026-08-25
  // 起始日應為上上期隔天 2026-08-26，截止日為今日 2026-10-17
  const result = getStatementCycleDates(25, null, new Date('2026-10-17T12:00:00+08:00'));
  assert.equal(result.isValid, true);
  assert.equal(result.startDate, '2026-08-26', '起始日應為上上期結帳日隔天 2026-08-26');
  assert.equal(result.endDate, '2026-10-17', '截止日應為今日 2026-10-17');
  assert.equal(result.statementDate, '2026-10-25', '當期目標結帳日應為 2026-10-25');
  assert.equal(result.prevStatementDate, '2026-08-25', '歷史延入款判斷基準應為上上期結帳日 2026-08-25');
  assert.equal(result.isPreStatement, true);
  assert.equal(result.statusLabel, 'before_statement');
  assert.equal(result.displayText, '上上期次日 2026-08-26 ～ 今日 2026-10-17（結帳日 25 號未到）');
});

test('Cycle Suite - 已達或已過當期結帳日結算區間 (ADR-0030: currDay >= statementDay)', () => {
  // 今日 2026-10-17，結帳日 15 號 (已過 15 號)
  // 上期為 2026-09-15，起始日應為上期隔天 2026-09-16，截止日為今日 2026-10-17
  const result = getStatementCycleDates(15, null, new Date('2026-10-17T12:00:00+08:00'));
  assert.equal(result.isValid, true);
  assert.equal(result.startDate, '2026-09-16', '起始日應為上期結帳日隔天 2026-09-16');
  assert.equal(result.endDate, '2026-10-17', '截止日應為今日 2026-10-17');
  assert.equal(result.statementDate, '2026-10-15', '本期結帳日應為 2026-10-15');
  assert.equal(result.prevStatementDate, '2026-09-15', '歷史延入款判斷基準應為上期結帳日 2026-09-15');
  assert.equal(result.isPreStatement, false);
  assert.equal(result.statusLabel, 'after_statement');
  assert.equal(result.displayText, '上期次日 2026-09-16 ～ 今日 2026-10-17（結帳日 15 號已過）');
});

test('Cycle Suite - 今日剛好等於結帳日當天 (ADR-0030: currDay === statementDay)', () => {
  // 今日 2026-10-15，結帳日 15 號
  const result = getStatementCycleDates(15, null, new Date('2026-10-15T12:00:00+08:00'));
  assert.equal(result.isValid, true);
  assert.equal(result.startDate, '2026-09-16');
  assert.equal(result.endDate, '2026-10-15');
  assert.equal(result.displayText, '上期次日 2026-09-16 ～ 今日 2026-10-15（今日為結帳日 15 號）');
});

test('Cycle Suite - 跨年邊界情境 (ADR-0030: January before statement day)', () => {
  // 今日 2026-01-10，結帳日 20 號 (未到 1/20)
  // 上期為 2025-12-20，上上期為 2025-11-20
  // 起始日應為 2025-11-21，截止日為 2026-01-10
  const result = getStatementCycleDates(20, null, new Date('2026-01-10T12:00:00+08:00'));
  assert.equal(result.isValid, true);
  assert.equal(result.startDate, '2025-11-21', '跨年起日應為 2025-11-21');
  assert.equal(result.endDate, '2026-01-10');
  assert.equal(result.statementDate, '2026-01-20');
  assert.equal(result.prevStatementDate, '2025-11-20');
  assert.equal(result.displayText, '上上期次日 2025-11-21 ～ 今日 2026-01-10（結帳日 20 號未到）');
});

test('Cycle Suite - 跨 2 月底邊界情境 (ADR-0030: March with 31st statement day)', () => {
  // 今日 2026-03-10，結帳日 31 號 (未到 3/31)
  // 2 月最後一天為 2026-02-28，1 月為 2026-01-31
  // 上上期為 2026-01-31，隔天為 2026-02-01
  const result = getStatementCycleDates(31, null, new Date('2026-03-10T12:00:00+08:00'));
  assert.equal(result.isValid, true);
  assert.equal(result.startDate, '2026-02-01', '跨 2 月起日應為 2026-02-01');
  assert.equal(result.endDate, '2026-03-10');
  assert.equal(result.displayText, '上上期次日 2026-02-01 ～ 今日 2026-03-10（結帳日 31 號未到）');
});

test('Cycle Suite - 未設定結帳日卡片防呆 (ADR-0030: Missing statement day)', () => {
  const resultNull = getStatementCycleDates(null);
  assert.equal(resultNull.isValid, false);
  assert.equal(resultNull.displayText, '未設定每月結帳日');

  const resultZero = getStatementCycleDates(0);
  assert.equal(resultZero.isValid, false);

  const result32 = getStatementCycleDates(32);
  assert.equal(result32.isValid, false);
});

test('Cycle Suite - 重複出帳覆蓋之延期狀態保持 (ADR-0030: State Overwrite Semantics)', () => {
  const rawTxs = [
    {
      id: 'tx-history-unbilled',
      date: '2026-08-20', // 早於起始日 8/26 且未出帳 -> 歷史延入款
      amount: 1000,
      defer_to_next_statement: 0,
      is_billed: 0,
    },
    {
      id: 'tx-cycle-billed',
      date: '2026-09-01', // 區間內先前已出帳項目 -> 重複出帳時預設納入結算
      amount: 2000,
      defer_to_next_statement: 0,
      is_billed: 1,
    },
    {
      id: 'tx-cycle-deferred',
      date: '2026-09-15', // 區間內曾被標記為延期之未出帳項目 -> 維持勾選延期
      amount: 800,
      defer_to_next_statement: 1,
      is_billed: 0,
    },
    {
      id: 'tx-cycle-new',
      date: '2026-10-05', // 區間內新發生的未出帳項目 -> 預設納入結算
      amount: 1500,
      defer_to_next_statement: 0,
      is_billed: 0,
    }
  ];

  // 判定基準日設為 2026-08-25 (上上期結帳日)
  const enriched = determineEnrichedTransactionStates(rawTxs, '2026-10-25', '2026-08-25');

  const historyItem = enriched.find(t => t.id === 'tx-history-unbilled');
  assert.equal(historyItem.is_prior_deferred, true, '早於上上期且未結應為歷史延入款');
  assert.equal(historyItem.is_initially_deferred, false, '預設納入結算');

  const billedItem = enriched.find(t => t.id === 'tx-cycle-billed');
  assert.equal(billedItem.is_prior_deferred, false);
  assert.equal(billedItem.is_initially_deferred, false, '已出帳項目重複出帳時預設納入結算');

  const deferredItem = enriched.find(t => t.id === 'tx-cycle-deferred');
  assert.equal(deferredItem.is_initially_deferred, true, '曾指定延期之項目維持勾選延期');

  const newItem = enriched.find(t => t.id === 'tx-cycle-new');
  assert.equal(newItem.is_initially_deferred, false, '新項目預設納入結算');
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
