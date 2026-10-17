import { getTaipeiDateString } from './date.js';

export interface StatementCycleResult {
  isValid: boolean;
  statementDay: number;
  startDate: string;
  endDate: string;
  statementDate: string;
  prevStatementDate: string;
  isPreStatement: boolean;
  preStatementDate: string;
  statusLabel: 'before_statement' | 'after_statement';
  displayText: string;
}

export function getMonthStatementDate(year: number, month: number, statementDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(statementDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getNextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = next.getUTCMonth() + 1;
  const nd = next.getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * 依據卡片結帳日 (statement_day) 與客觀日曆天，精確推算當前出帳作業之結算區間 (ADR-0030)
 * 1. 當期結帳日未到 (currDay < statementDay)：
 *    - 起始日：上上期結帳日隔天
 *    - 截止日：今日 (當日)
 *    - 頂部標籤：「上上期次日 YYYY-MM-DD ～ 今日 YYYY-MM-DD（結帳日 N 號未到）」
 * 2. 當期結帳日已達或已過 (currDay >= statementDay)：
 *    - 起始日：上期結帳日隔天
 *    - 截止日：今日 (當日)
 *    - 頂部標籤：「上期次日 YYYY-MM-DD ～ 今日 YYYY-MM-DD（結帳日 N 號已過/已達）」
 * 3. 不依賴歷史出帳時間戳記推進月份，支援隨時重複開啟與重新覆蓋出帳
 */
export function getStatementCycleDates(
  statementDay: number | null | undefined,
  _lastRolloverAt?: string | null,
  targetDate: Date = new Date()
): StatementCycleResult {
  const taipeiDateStr = getTaipeiDateString(targetDate);
  if (!statementDay || statementDay < 1 || statementDay > 31) {
    return {
      isValid: false,
      statementDay: 0,
      startDate: '',
      endDate: taipeiDateStr,
      statementDate: '',
      prevStatementDate: '',
      isPreStatement: false,
      preStatementDate: taipeiDateStr,
      statusLabel: 'before_statement',
      displayText: '未設定每月結帳日',
    };
  }

  const [currYear, currMonth, currDay] = taipeiDateStr.split('-').map(Number);
  const isPreStatement = currDay < statementDay;

  // 1. 本月結帳日 S_curr
  const curMonthStatementDate = getMonthStatementDate(currYear, currMonth, statementDay);

  // 2. 上期結帳日 S_prev1
  let prevYear = currYear;
  let prevMonth = currMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prev1StatementDate = getMonthStatementDate(prevYear, prevMonth, statementDay);

  // 3. 上上期結帳日 S_prev2
  let prev2Year = prevYear;
  let prev2Month = prevMonth - 1;
  if (prev2Month === 0) {
    prev2Month = 12;
    prev2Year -= 1;
  }
  const prev2StatementDate = getMonthStatementDate(prev2Year, prev2Month, statementDay);

  let startDate = '';
  let endDate = '';
  let statementDate = '';
  let prevStatementDate = '';
  let statusLabel: 'before_statement' | 'after_statement' = 'before_statement';
  let displayText = '';

  if (isPreStatement) {
    // 當月結帳日未到：結算上一個已完整結束的帳期（上上期結帳日隔天 ～ 上期結帳日）
    startDate = getNextDay(prev2StatementDate);
    endDate = prev1StatementDate;
    statementDate = prev1StatementDate;
    prevStatementDate = prev2StatementDate;
    statusLabel = 'before_statement';
    displayText = `${startDate} ～ ${endDate}（當月 ${statementDay} 號結帳日未到，結算上期帳單）`;
  } else {
    // 當月結帳日已達或已過：結算本期已完整結束的帳期（上期結帳日隔天 ～ 本月結帳日）
    startDate = getNextDay(prev1StatementDate);
    endDate = curMonthStatementDate;
    statementDate = curMonthStatementDate;
    prevStatementDate = prev1StatementDate;
    statusLabel = 'after_statement';
    const dayDesc = currDay === statementDay ? `今日為 ${statementDay} 號結帳日` : `當月 ${statementDay} 號結帳日已過`;
    displayText = `${startDate} ～ ${endDate}（${dayDesc}，結算本期帳單）`;
  }

  return {
    isValid: true,
    statementDay,
    startDate,
    endDate,
    statementDate,
    prevStatementDate,
    isPreStatement,
    preStatementDate: taipeiDateStr,
    statusLabel,
    displayText,
  };
}

export interface TransactionWithDeferral {
  id: string;
  date: string;
  amount: number;
  defer_to_next_statement: number;
  is_billed: number;
  [key: string]: any;
}

export interface EnrichedTransactionState extends TransactionWithDeferral {
  is_prior_deferred: boolean;
  is_initially_deferred: boolean;
}

/**
 * 判定出帳預覽中每筆交易的上期延入標籤與預設延期狀態 (ADR-0028, ADR-0030)
 * 核心原則：
 * 1. 凡早於結算起始日 (t.date <= prevStatementDate) 且未出帳者，標示為上期延入款 (is_prior_deferred = true)
 * 2. 上期延入款 (is_prior_deferred = true) 一律預設列入本期出帳計算、取消勾選延至下期 (is_initially_deferred = false)
 * 3. 本期區間內 (startDate <= t.date <= endDate) 交易：若為未出帳且已被標記延至下期 (defer_to_next_statement = 1)，維持勾選延至下期 (is_initially_deferred = true)；其餘預設列入結算
 */
export function determineEnrichedTransactionStates<T extends TransactionWithDeferral>(
  rawTxs: T[],
  _statementDate?: string,
  prevStatementDate?: string,
  _hasRolledCycle?: boolean
): Array<T & { is_prior_deferred: boolean; is_initially_deferred: boolean }> {
  return rawTxs.map(t => {
    let isPriorDeferred = false;
    if (prevStatementDate) {
      // 交易日早於或等於上期/上上期判定基準日且未出帳者，屬於歷史延入款
      isPriorDeferred = Boolean(t.date <= prevStatementDate && Number(t.is_billed) === 0);
    } else {
      isPriorDeferred = Boolean(Number(t.defer_to_next_statement) === 1 && Number(t.is_billed) === 0);
    }

    // 上期延入款一律預設列入本期出帳結算 (is_initially_deferred = false)
    // 僅針對本期區間內的交易維持其當前的延後標記 (ADR-0030)
    const isInitiallyDeferred = isPriorDeferred
      ? false
      : Boolean(Number(t.is_billed) === 0 && Number(t.defer_to_next_statement) === 1);

    return {
      ...t,
      is_prior_deferred: isPriorDeferred,
      is_initially_deferred: isInitiallyDeferred,
    };
  });
}

export interface RolloverDebtBreakdown {
  totalExpense: number;
  totalRefund: number;
  netRolledAmount: number;
  sharedDebt: number;
  personalDebt: number;
}

/**
 * 計算出帳作業中之總支出、總刷退、出帳淨額與公私帳拆解 (ADR-0029)
 * 核心原則：
 * 1. 僅未在家庭報銷之公帳代墊計入 sharedDebt
 * 2. 已在家庭報銷結清之公帳代墊轉列 personalDebt（由持卡人自負繳費向銀行繳款）
 * 3. 公帳刷退優先折抵 sharedDebt
 */
export function calculateRolloverDebtBreakdown(
  activeTxs: Array<{
    amount: number;
    type: string;
    is_shared?: number;
    reimbursement_id?: string | null;
  }>
): RolloverDebtBreakdown {
  const expenseTxs = activeTxs.filter(t => t.type === 'expense');
  const refundTxs = activeTxs.filter(t => t.type === 'income');

  const totalExpense = expenseTxs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalRefund = refundTxs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const netRolledAmount = Math.max(0, totalExpense - totalRefund);

  // 公帳未報銷支出（已於家庭報銷結清者，轉由持卡人個人自負繳費，不計入 sharedDebt）
  const sharedExpense = expenseTxs
    .filter(t => Number(t.is_shared) === 1 && (!t.reimbursement_id || String(t.reimbursement_id).trim() === ''))
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // 公帳刷退優先折抵公帳欠款
  const sharedRefund = refundTxs
    .filter(t => Number(t.is_shared) === 1)
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const sharedDebt = Math.max(0, sharedExpense - sharedRefund);
  const personalDebt = Math.max(0, netRolledAmount - sharedDebt);

  return {
    totalExpense,
    totalRefund,
    netRolledAmount,
    sharedDebt,
    personalDebt,
  };
}

