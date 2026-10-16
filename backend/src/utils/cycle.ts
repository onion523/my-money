import { getTaipeiDateString } from './date.js';

export interface StatementCycleResult {
  statementDate: string;
  prevStatementDate: string;
  isPreStatement: boolean;
  preStatementDate: string;
}

/**
 * 依據卡片結帳日 (statement_day) 與上次出帳紀錄 (last_rollover_at)，精確推算當前出帳作業之結算區間
 * 支援未到結帳日提前出帳 (Pre-statement rollover)，並在已出帳後自動推進至下一期 (ADR-0028)
 */
export function getStatementCycleDates(
  statementDay: number | null | undefined,
  lastRolloverAt?: string | null,
  targetDate: Date = new Date()
): StatementCycleResult {
  const taipeiDateStr = getTaipeiDateString(targetDate);
  if (!statementDay || statementDay < 1 || statementDay > 31) {
    return {
      statementDate: '',
      prevStatementDate: '',
      isPreStatement: false,
      preStatementDate: taipeiDateStr,
    };
  }

  const [currYear, currMonth, currDay] = taipeiDateStr.split('-').map(Number);
  let statementYear = currYear;
  let statementMonth = currMonth;
  let isPreStatement = false;

  let lastRolloverDateStr = '';
  if (lastRolloverAt) {
    const raw = String(lastRolloverAt).trim();
    const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      lastRolloverDateStr = getTaipeiDateString(d);
    }
  }

  // 計算本月結帳日
  const curMonthLastDay = new Date(currYear, currMonth, 0).getDate();
  const curMonthStatementDay = Math.min(statementDay, curMonthLastDay);
  const curMonthStatementDate = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(curMonthStatementDay).padStart(2, '0')}`;

  if (currDay < statementDay) {
    // 1. 未到當期結帳日 (例如今日 10/16，結帳日 25 號)：
    // 當前正在累積的週期目標結帳日即為「本月結帳日」(2026-10-25)，上期結帳日為「上月結帳日」(2026-09-25)
    // 判定為提前出帳 (isPreStatement = true)
    isPreStatement = true;
    statementYear = currYear;
    statementMonth = currMonth;
  } else {
    // 2. 當日已達或超過當月結帳日 (currDay >= statementDay)：
    // 檢查本月結帳日是否已經執行過出帳 (lastRolloverDateStr >= curMonthStatementDate)
    if (lastRolloverDateStr && lastRolloverDateStr >= curMonthStatementDate) {
      // 本期已出帳過，再次點擊出帳作業代表提前檢視／預覽「下個月週期」
      isPreStatement = true;
      statementMonth += 1;
      if (statementMonth === 13) {
        statementMonth = 1;
        statementYear += 1;
      }
    } else {
      // 本期尚未出帳，結帳日已到達，屬於常態出帳
      isPreStatement = false;
      statementYear = currYear;
      statementMonth = currMonth;
    }
  }

  const lastDayOfMonth = new Date(statementYear, statementMonth, 0).getDate();
  const day = Math.min(statementDay, lastDayOfMonth);
  const statementDate = `${statementYear}-${String(statementMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 推算上一個結帳日
  let prevYear = statementYear;
  let prevMonth = statementMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const pDay = Math.min(statementDay, prevLastDay);
  const prevStatementDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;

  return {
    statementDate,
    prevStatementDate,
    isPreStatement,
    preStatementDate: taipeiDateStr,
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
 * 判定出帳預覽中每筆交易的上期延入標籤與預設延期狀態 (ADR-0028)
 * 核心原則：所有歷史週期延入款（包含日常記帳勾選延期或前次出帳延期者），在首度出帳預覽時「一律預設自動喚醒納入結算」
 */
export function determineEnrichedTransactionStates<T extends TransactionWithDeferral>(
  rawTxs: T[],
  statementDate: string,
  prevStatementDate: string,
  hasRolledCycle: boolean
): Array<T & { is_prior_deferred: boolean; is_initially_deferred: boolean }> {
  return rawTxs.map(t => {
    let isPriorDeferred = false;
    if (statementDate && prevStatementDate) {
      // 交易日早於或等於上期結帳日且未出帳者，屬於上期延入款
      isPriorDeferred = Boolean(t.date <= prevStatementDate && Number(t.is_billed) === 0);
    } else {
      // 未設定結帳日卡片：曾標記延期且未出帳者視同延入款
      isPriorDeferred = Boolean(Number(t.defer_to_next_statement) === 1 && Number(t.is_billed) === 0);
    }

    let isInitiallyDeferred = false;
    if (hasRolledCycle) {
      // 若當期已執行過出帳（二次開啟檢視）：仍為未出帳且標記延期者，代表上次出帳時已明確選擇延期
      isInitiallyDeferred = Number(t.is_billed) === 0 && Number(t.defer_to_next_statement) === 1;
    } else {
      // 若當期尚未出帳（首度出帳預覽）：
      // 歷史延入款一律自動喚醒為納入本期出帳 (isInitiallyDeferred = false)
      // 未設定結帳日卡片之未出帳項目亦預設納入出帳
      if (isPriorDeferred) {
        isInitiallyDeferred = false;
      } else if (!statementDate) {
        isInitiallyDeferred = false;
      } else {
        // 當期刷卡且被手動指定延期者，維持延至下期
        isInitiallyDeferred = Number(t.defer_to_next_statement) === 1;
      }
    }

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

