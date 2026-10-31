import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware } from '../middleware/jwt';
import { getTaipeiDateString, getTaipeiForecastDays } from '../utils/date';
import { getUserHousehold } from './households';
import { ensureRecurringSchema } from './recurring';
import { computeCreditCardsReadOnlyMetrics, ensureAccountsSchema } from './accounts';

type Vars = { userId: string; userEmail: string; userName: string };
const forecast = new Hono<{ Bindings: Env; Variables: Vars }>();
forecast.use('*', authMiddleware);

const CYCLE_MONTHS: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };

let forecastSchemaMigrated = false;
let forecastMigratePromise: Promise<void> | null = null;
export async function ensureForecastSchema(db: any) {
  if (forecastSchemaMigrated) return;
  if (!forecastMigratePromise) {
    forecastMigratePromise = (async () => {
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS forecast_settled_events (
            event_key TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch (_) {}
      forecastSchemaMigrated = true;
    })().finally(() => {
      forecastMigratePromise = null;
    });
  }
  await forecastMigratePromise;
}

export interface ForecastEvent {
  event_key: string;
  date: string;
  name: string;
  type: string;
  amount: number;
  is_shared: number;
  account_name?: string;
  is_settled?: boolean;
  can_settle?: boolean;
  running_balance?: number;
}

export interface ForecastRecurringItem extends RecurringItem {
  account_name?: string;
  account_type?: string;
  statement_day?: number | null;
  payment_due_day?: number | null;
  is_shared?: number;
}

const creditCardDueDateCache = new Map<string, { year: number; month: number; day: number; dateStr: string }>();

export function calculateCreditCardDueDate(
  chargeYear: number,
  chargeMonth: number,
  chargeDay: number,
  statementDay: number | null,
  paymentDueDay: number
): { year: number; month: number; day: number; dateStr: string } {
  const cacheKey = `${chargeYear}-${chargeMonth}-${chargeDay}-${statementDay ?? 20}-${paymentDueDay}`;
  const cached = creditCardDueDateCache.get(cacheKey);
  if (cached) return cached;

  const stmtDay = statementDay || 20;
  let dueYear = chargeYear;
  let dueMonth = chargeMonth;

  if (stmtDay < paymentDueDay) {
    if (chargeDay <= stmtDay) {
      dueMonth = chargeMonth;
    } else {
      dueMonth = chargeMonth + 1;
    }
  } else {
    if (chargeDay <= stmtDay) {
      dueMonth = chargeMonth + 1;
    } else {
      dueMonth = chargeMonth + 2;
    }
  }

  if (dueMonth > 12) {
    dueYear += Math.floor((dueMonth - 1) / 12);
    dueMonth = ((dueMonth - 1) % 12) + 1;
  }

  const maxDaysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
  const actualDueDay = Math.min(paymentDueDay, maxDaysInDueMonth);
  const dateStr = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;
  const result = { year: dueYear, month: dueMonth, day: actualDueDay, dateStr };
  creditCardDueDateCache.set(cacheKey, result);
  return result;
}

export function parseRolloverTaipeiDate(lastRolloverAt?: string | null): string | null {
  if (!lastRolloverAt) return null;
  const trimmed = lastRolloverAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  let iso = trimmed;
  if (!iso.includes('T') && !iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso = iso.replace(' ', 'T') + 'Z';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return getTaipeiDateString(d);
}

export function resolveBilledCardSchedule(
  todayObj: { year: number; month: number; day: number; dateStr: string },
  minDateStr: string,
  maxDateStr: string,
  statementDay: number | null,
  paymentDueDay: number,
  lastRolloverAt?: string | null
): { originalDueDate: string; scheduledDate: string; isOverdue: boolean } | null {
  let originalDueDate: string;

  if (statementDay) {
    const stmtDay = statementDay;
    const maxDaysThisMonth = new Date(todayObj.year, todayObj.month, 0).getDate();
    const clampedTodayStmtDay = Math.min(stmtDay, maxDaysThisMonth);
    const thisMonthStmtDateStr = `${todayObj.year}-${String(todayObj.month).padStart(2, '0')}-${String(clampedTodayStmtDay).padStart(2, '0')}`;

    const rolloverDateStr = parseRolloverTaipeiDate(lastRolloverAt);
    const hasRolledThisMonth = rolloverDateStr ? rolloverDateStr >= thisMonthStmtDateStr : false;

    let stmtYear = todayObj.year;
    let stmtMonth = todayObj.month;

    // 若今日尚未到達本月結帳日，或雖已過本月結帳日但尚未執行過本月結帳日出帳，則此筆已出帳餘額源自「上月（或更早）結帳週期」
    if (todayObj.day < clampedTodayStmtDay || (lastRolloverAt && !hasRolledThisMonth)) {
      stmtMonth -= 1;
      if (stmtMonth < 1) {
        stmtYear -= 1;
        stmtMonth = 12;
      }
    }

    const maxDaysStmtMonth = new Date(stmtYear, stmtMonth, 0).getDate();
    const due = calculateCreditCardDueDate(
      stmtYear,
      stmtMonth,
      Math.min(stmtDay, maxDaysStmtMonth),
      stmtDay,
      paymentDueDay
    );
    originalDueDate = due.dateStr;
  } else {
    // 未設定結帳日之信用卡：以當月繳款日為原訂扣繳基準（若當月已過則視為當月逾期未扣，尚未過則為當月即將扣款）
    const maxDaysThisMonth = new Date(todayObj.year, todayObj.month, 0).getDate();
    const actualDueDay = Math.min(paymentDueDay, maxDaysThisMonth);
    originalDueDate = `${todayObj.year}-${String(todayObj.month).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;
  }

  const isOverdue = originalDueDate < todayObj.dateStr;
  const scheduledDate = isOverdue ? todayObj.dateStr : originalDueDate;

  if (scheduledDate >= minDateStr && scheduledDate <= maxDateStr) {
    return { originalDueDate, scheduledDate, isOverdue };
  }
  return null;
}

export function resolveUnbilledCardSchedule(
  todayObj: { year: number; month: number; day: number; dateStr: string },
  minDateStr: string,
  maxDateStr: string,
  statementDay: number | null,
  paymentDueDay: number,
  hasBilledBalance: boolean,
  billedOriginalDueDate: string | null,
  lastRolloverAt?: string | null
): { originalDueDate: string; scheduledDate: string; isOverdue: boolean } | null {
  const stmtDay = statementDay || 20;
  const maxDaysInTodayMonth = new Date(todayObj.year, todayObj.month, 0).getDate();
  const clampedTodayStmtDay = Math.min(stmtDay, maxDaysInTodayMonth);
  const thisMonthStmtDateStr = `${todayObj.year}-${String(todayObj.month).padStart(2, '0')}-${String(clampedTodayStmtDay).padStart(2, '0')}`;

  const rolloverDateStr = parseRolloverTaipeiDate(lastRolloverAt);
  const hasRolledCurrentCycle = rolloverDateStr ? rolloverDateStr >= thisMonthStmtDateStr : false;

  let stmtYear = todayObj.year;
  let stmtMonth = todayObj.month;

  // 僅當「今日已過本月結帳日」且「本期已執行出帳（last_rollover_at >= 本月結帳日，或卡上已有已出帳待繳餘額）」時，未出帳才歸入下月結帳週期
  // 若已過本月結帳日但使用者尚未手動按「出帳作業」且無已出帳餘額，該筆未出帳仍歸屬本月結帳週期之繳款日
  if (todayObj.day > clampedTodayStmtDay && (hasRolledCurrentCycle || hasBilledBalance)) {
    stmtMonth += 1;
    if (stmtMonth > 12) {
      stmtYear += 1;
      stmtMonth -= 12;
    }
  }

  const maxDaysInStmtMonth = new Date(stmtYear, stmtMonth, 0).getDate();
  let due = calculateCreditCardDueDate(
    stmtYear,
    stmtMonth,
    Math.min(stmtDay, maxDaysInStmtMonth),
    stmtDay,
    paymentDueDay
  );

  // 防重疊保護：以已出帳之「原訂扣款日 (billedOriginalDueDate)」比對，避免逾期平移或未出帳與已出帳落入同一期
  if (billedOriginalDueDate && due.dateStr <= billedOriginalDueDate) {
    stmtMonth += 1;
    if (stmtMonth > 12) {
      stmtYear += 1;
      stmtMonth -= 12;
    }
    const nextMaxDays = new Date(stmtYear, stmtMonth, 0).getDate();
    due = calculateCreditCardDueDate(
      stmtYear,
      stmtMonth,
      Math.min(stmtDay, nextMaxDays),
      stmtDay,
      paymentDueDay
    );
  }

  const originalDueDate = due.dateStr;
  const isOverdue = originalDueDate < todayObj.dateStr;
  const scheduledDate = isOverdue ? todayObj.dateStr : originalDueDate;

  if (scheduledDate >= minDateStr && scheduledDate <= maxDateStr) {
    return { originalDueDate, scheduledDate, isOverdue };
  }
  return null;
}

const FORECAST_DAYS = 365;

function getDaysInForecast(
  items: ForecastRecurringItem[],
  days = FORECAST_DAYS,
  settledKeys: Set<string> = new Set(),
  userId = '',
  myRole: string | null = 'member'
): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  const forecastDays = getTaipeiForecastDays(days);
  const minDateStr = forecastDays[0].dateStr;
  const maxDateStr = forecastDays[forecastDays.length - 1].dateStr;

  // 1. 預先蒐集預測區間涵蓋的所有月份及其最大天數 (至多 13~14 個月份，消除在 365 逐日雙重迴圈中重複計算)
  const monthMap = new Map<string, { year: number; month: number; maxDays: number }>();
  for (const d of forecastDays) {
    const key = `${d.year}-${d.month}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        year: d.year,
        month: d.month,
        maxDays: new Date(d.year, d.month, 0).getDate(),
      });
    }
  }
  const months = Array.from(monthMap.values());

  // 2. 針對各週期項目直接進行投影 (Event Direct Projection)
  // 將複雜度由 O(days * items) 降為 O(months * items)，消除 95%+ 迴圈開銷
  for (const item of items) {
    const cycleM = CYCLE_MONTHS[item.cycle] || 1;
    const anchorM = item.month_of_cycle || 1;
    const isShared = item.is_shared ?? 0;
    const canSettle = isShared === 0 ? item.user_id === userId : (item.user_id === userId || myRole === 'admin');

    for (const m of months) {
      const monthDiff = m.month - anchorM;
      const isCycleMonth = ((monthDiff % cycleM) + cycleM) % cycleM === 0;
      if (!isCycleMonth) continue;

      const targetDay = Math.min(item.day_of_cycle, m.maxDays);
      const dayStr = String(targetDay).padStart(2, '0');
      const monthStr = String(m.month).padStart(2, '0');
      const itemDateStr = `${m.year}-${monthStr}-${dayStr}`;

      if (item.account_type === 'credit_card' && item.payment_due_day) {
        // 信用卡扣款週期收支：平移至該卡所屬之信用卡繳款日 (Payment Due Day)
        const due = calculateCreditCardDueDate(m.year, m.month, targetDay, item.statement_day ?? null, item.payment_due_day);
        if (due.dateStr >= minDateStr && due.dateStr <= maxDateStr) {
          const eventKey = `recurring:${item.id}:${due.dateStr}`;
          events.push({
            event_key: eventKey,
            date: due.dateStr,
            name: `${item.name} (${item.account_name || '信用卡'} · 信用卡繳款日扣款)`,
            type: item.type,
            amount: item.amount,
            is_shared: isShared,
            account_name: item.account_name || undefined,
            is_settled: settledKeys.has(eventKey),
            can_settle: canSettle,
          });
        }
      } else {
        // 現金或銀行活存扣款：維持於排程扣款日
        if (itemDateStr >= minDateStr && itemDateStr <= maxDateStr) {
          const eventKey = `recurring:${item.id}:${itemDateStr}`;
          events.push({
            event_key: eventKey,
            date: itemDateStr,
            name: item.name,
            type: item.type,
            amount: item.amount,
            is_shared: isShared,
            account_name: item.account_name || undefined,
            is_settled: settledKeys.has(eventKey),
            can_settle: canSettle,
          });
        }
      }
    }
  }

  // 3. 事件依發生日期排序
  events.sort((a, b) => a.date.localeCompare(b.date) || a.event_key.localeCompare(b.event_key));
  return events;
}

// 試算第 0 天起始基準可用餘額與信用卡繳卡費事件 (12 個月 / 365 天期程：已出帳排入最近扣繳日，逾期未扣繳則排入今日 D0；未出帳排入下次結帳日出帳後之扣繳日)
async function getForecastStartingBalance(
  db: any,
  userId: string,
  scope: string,
  memberUserIds: string[],
  days = FORECAST_DAYS,
  settledKeys: Set<string> = new Set(),
  myRole: string | null = 'member'
) {
  await ensureAccountsSchema(db);
  const placeholders = memberUserIds.map(() => '?').join(',');
  let sqlCondition = `(user_id = ? OR (user_id IN (${placeholders}) AND is_joint = 1))`;
  let sqlParams: any[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    sqlCondition = `user_id IN (${placeholders}) AND is_joint = 1`;
    sqlParams = [...memberUserIds];
  } else if (scope === 'personal') {
    sqlCondition = `user_id = ? AND is_joint = 0`;
    sqlParams = [userId];
  }

  const allAccounts = await db.prepare(`SELECT * FROM accounts WHERE ${sqlCondition}`).bind(...sqlParams).all();
  const accList = allAccounts.results as Array<{ type: string; balance: number }>;
  const cashTotal = accList.filter(a => a.type === 'cash').reduce((s, a) => s + (a.balance || 0), 0);
  const bankTotal = accList.filter(a => a.type === 'bank').reduce((s, a) => s + (a.balance || 0), 0);

  // 信用卡：依視角計算歸屬本視角之「已出帳 (balance)」與「未出帳 (unbilled)」
  const cardRows = await db.prepare(
    `SELECT id, user_id, name, balance, unbilled, is_joint, statement_day, payment_due_day, last_rollover_at FROM accounts WHERE type = 'credit_card' AND (user_id = ? OR user_id IN (${placeholders}))`
  ).bind(userId, ...memberUserIds).all();
  const cards = (cardRows.results || []) as Array<{
    id: string;
    user_id: string;
    name: string;
    balance: number;
    unbilled: number;
    is_joint: number;
    statement_day: number | null;
    payment_due_day: number | null;
    last_rollover_at?: string | null;
  }>;

  const forecastDays = getTaipeiForecastDays(days);
  const todayObj = forecastDays[0];
  const minDateStr = forecastDays[0].dateStr;
  const maxDateStr = forecastDays[forecastDays.length - 1].dateStr;

  let immediateCardDeduct = 0;
  const cardEvents: ForecastEvent[] = [];

  // 統一透過 computeCreditCardsReadOnlyMetrics 計算各卡之公私帳待繳分流（已於家庭協同報銷／沖銷之公帳消費自動轉列 personal_debt）
  const cardMetricsMap = await computeCreditCardsReadOnlyMetrics(db, cards);

  for (const card of cards) {
    const m = cardMetricsMap.get(card.id);
    const isOwn = card.user_id === userId;
    const isJoint = card.is_joint === 1;
    const rawBilled = Math.max(0, m ? m.balance : (card.balance || 0));
    const rawUnbilled = Math.max(0, m ? m.unbilled : (card.unbilled || 0));
    const totalDue = rawBilled + rawUnbilled;
    if (totalDue <= 0) continue;

    let billed = 0;
    let unbilled = 0;

    if (isJoint) {
      if (scope !== 'personal') {
        billed = rawBilled;
        unbilled = rawUnbilled;
      }
    } else if (scope === 'all' && isOwn) {
      billed = rawBilled;
      unbilled = rawUnbilled;
    } else if (scope === 'personal' && !isOwn) {
      billed = 0;
      unbilled = 0;
    } else {
      // 私卡於公帳或個人私帳視角（或全視角下他人私卡）：
      // 未報銷之公帳消費計入 shared_debt (公帳扣款)；已於家庭協同報銷／沖銷之公帳消費與個人消費計入 personal_debt (私帳扣款)
      const sharedBilled = m ? m.billed_shared_debt : 0;
      const sharedUnbilled = m ? m.unbilled_shared_debt : 0;
      const personalBilled = m ? m.billed_personal_debt : Math.max(0, rawBilled - sharedBilled);
      const personalUnbilled = m ? m.unbilled_personal_debt : Math.max(0, rawUnbilled - sharedUnbilled);

      billed = (scope === 'household' || !isOwn) ? sharedBilled : personalBilled;
      unbilled = (scope === 'household' || !isOwn) ? sharedUnbilled : personalUnbilled;
    }

    billed = Math.round(billed * 100) / 100;
    unbilled = Math.round(unbilled * 100) / 100;
    if (billed <= 0 && unbilled <= 0) continue;

    const isShared = isJoint || !isOwn || scope === 'household' ? 1 : 0;
    const canSettle = isShared === 0 ? isOwn : (isOwn || myRole === 'admin');

    if (card.payment_due_day) {
      const rawBilledSched = rawBilled > 0
        ? resolveBilledCardSchedule(
            todayObj,
            minDateStr,
            maxDateStr,
            card.statement_day,
            card.payment_due_day,
            card.last_rollover_at
          )
        : null;

      if (billed > 0) {
        if (rawBilledSched) {
          const eventKey = `card_due:${card.id}:${rawBilledSched.originalDueDate}`;
          const mmdd = rawBilledSched.originalDueDate.slice(5).replace('-', '/');
          const eventName = rawBilledSched.isOverdue
            ? `繳卡費 · ${card.name}（已出帳 · 原訂 ${mmdd} 扣款）`
            : `繳卡費 · ${card.name}（已出帳）`;
          cardEvents.push({
            event_key: eventKey,
            date: rawBilledSched.scheduledDate,
            name: eventName,
            type: 'expense',
            amount: billed,
            is_shared: isShared,
            account_name: card.name,
            is_settled: settledKeys.has(eventKey),
            can_settle: canSettle,
          });
        } else {
          immediateCardDeduct += billed;
        }
      }

      if (unbilled > 0) {
        const unbilledSched = resolveUnbilledCardSchedule(
          todayObj,
          minDateStr,
          maxDateStr,
          card.statement_day,
          card.payment_due_day,
          rawBilled > 0,
          rawBilledSched ? rawBilledSched.originalDueDate : null,
          card.last_rollover_at
        );
        if (unbilledSched) {
          const eventKey = `card_due:${card.id}:${unbilledSched.originalDueDate}:unbilled`;
          const mmdd = unbilledSched.originalDueDate.slice(5).replace('-', '/');
          const eventName = unbilledSched.isOverdue
            ? `繳卡費 · ${card.name}（未出帳 · 原訂 ${mmdd} 扣款）`
            : `繳卡費 · ${card.name}（未出帳）`;
          cardEvents.push({
            event_key: eventKey,
            date: unbilledSched.scheduledDate,
            name: eventName,
            type: 'expense',
            amount: unbilled,
            is_shared: isShared,
            account_name: card.name,
            is_settled: settledKeys.has(eventKey),
            can_settle: canSettle,
          });
        } else {
          immediateCardDeduct += unbilled;
        }
      }
    } else {
      immediateCardDeduct += billed + unbilled;
    }
  }

  const available = cashTotal + bankTotal - immediateCardDeduct;
  return { available, cashTotal, bankTotal, immediateCardDeduct, cardEvents };
}

async function getSettledKeysSet(db: any): Promise<Set<string>> {
  await ensureForecastSchema(db);
  const rows = await db.prepare('SELECT event_key FROM forecast_settled_events').all();
  const list = (rows.results || []) as Array<{ event_key: string }>;
  return new Set(list.map(r => r.event_key));
}

// GET /forecast (支援 scope = all | household | personal)
forecast.get('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const settledKeys = await getSettledKeysSet(c.env.DB);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available, cashTotal, bankTotal, cardEvents } = await getForecastStartingBalance(
    c.env.DB, userId, scope, memberUserIds, FORECAST_DAYS, settledKeys, myRole
  );
  let balance = available;

  let recCondition = `((r.user_id = ? AND r.is_shared = 0) OR (r.user_id IN (${placeholders}) AND r.is_shared = 1))`;
  let recParams: any[] = [userId, ...memberUserIds];
  if (scope === 'household') {
    recCondition = `r.user_id IN (${placeholders}) AND r.is_shared = 1`;
    recParams = [...memberUserIds];
  } else if (scope === 'personal') {
    recCondition = `r.user_id = ? AND r.is_shared = 0`;
    recParams = [userId];
  }

  const recRows = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.type as account_type, a.statement_day, a.payment_due_day
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE ${recCondition}
    ORDER BY r.created_at ASC
  `).bind(...recParams).all();

  const items = recRows.results as unknown as ForecastRecurringItem[];
  const events = [...getDaysInForecast(items, FORECAST_DAYS, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => {
    const dateDiff = x.date.localeCompare(y.date);
    if (dateDiff !== 0) return dateDiff;
    if (x.type !== y.type) return x.type === 'income' ? -1 : 1;
    return 0;
  });

  // 逐日模擬（ADR 0018：已勾選 is_settled 之事件不列入餘額加減）
  const forecastDays = getTaipeiForecastDays(FORECAST_DAYS);
  const dailyBalances: Array<{ date: string; balance: number; events: ForecastEvent[] }> = [];
  let minBalance = balance;
  let minDate = forecastDays[0]?.dateStr || '';

  for (let d = 0; d < FORECAST_DAYS; d++) {
    const dateStr = forecastDays[d].dateStr;
    const dayEvents = events.filter(e => e.date === dateStr);
    dayEvents.forEach(e => {
      if (!e.is_settled) {
        balance += e.type === 'income' ? e.amount : -e.amount;
      }
      e.running_balance = Math.round(balance * 100) / 100;
    });
    if (balance < minBalance) { minBalance = balance; minDate = dateStr; }
    dailyBalances.push({ date: dateStr, balance: Math.round(balance * 100) / 100, events: dayEvents });
  }

  return c.json({
    success: true,
    data: {
      startingBalance: Math.round(available * 100) / 100,
      cashTotal: Math.round(cashTotal * 100) / 100,
      bankTotal: Math.round(bankTotal * 100) / 100,
      dailyBalances,
      minBalance: Math.round(minBalance * 100) / 100,
      minDate,
      willOverdraft: minBalance < 0,
      events
    }
  });
});

// POST /forecast/purchase-check (支援 scope = all | household | personal)
forecast.post('/purchase-check', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const settledKeys = await getSettledKeysSet(c.env.DB);
  const { amount, scope = 'all' } = await c.req.json();
  if (!amount || amount <= 0) return c.json({ success: false, error: '請輸入有效金額' }, 400);

  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available, cardEvents } = await getForecastStartingBalance(
    c.env.DB, userId, scope, memberUserIds, FORECAST_DAYS, settledKeys, myRole
  );
  let balance = available - amount;

  // 儲蓄目標影響 (ADR 0016: 公帳視角不檢核成員個人私密儲蓄目標)
  let affectedGoals: Array<{ name: string; saved_amount: number; target_amount: number; monthly_reserve: number }> = [];
  let affectsSavings = false;

  if (scope !== 'household') {
    const goals = await c.env.DB.prepare('SELECT * FROM goals WHERE user_id = ?').bind(userId).all();
    const goalList = goals.results as Array<{ name: string; saved_amount: number; target_amount: number; monthly_reserve: number }>;
    affectedGoals = goalList.filter(g => g.monthly_reserve > 0);
    const totalReserve = affectedGoals.reduce((s, g) => s + g.monthly_reserve, 0);
    affectsSavings = affectedGoals.length > 0 && balance < totalReserve;
  }

  // 60天現金流（ADR 0018：跳過已勾選 is_settled 之事件）
  let recCondition = `((r.user_id = ? AND r.is_shared = 0) OR (r.user_id IN (${placeholders}) AND r.is_shared = 1))`;
  let recParams: any[] = [userId, ...memberUserIds];
  if (scope === 'household') {
    recCondition = `r.user_id IN (${placeholders}) AND r.is_shared = 1`;
    recParams = [...memberUserIds];
  } else if (scope === 'personal') {
    recCondition = `r.user_id = ? AND r.is_shared = 0`;
    recParams = [userId];
  }

  const recRows = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.type as account_type, a.statement_day, a.payment_due_day
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE ${recCondition}
    ORDER BY r.created_at ASC
  `).bind(...recParams).all();

  const items = recRows.results as unknown as ForecastRecurringItem[];
  const events = [...getDaysInForecast(items, FORECAST_DAYS, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => {
    const dateDiff = x.date.localeCompare(y.date);
    if (dateDiff !== 0) return dateDiff;
    if (x.type !== y.type) return x.type === 'income' ? -1 : 1;
    return 0;
  });
  let minBalance = balance;
  events.forEach(e => {
    if (!e.is_settled) {
      balance += e.type === 'income' ? e.amount : -e.amount;
      if (balance < minBalance) minBalance = balance;
    }
  });

  const willOverdraft = minBalance < 0;
  let verdict: 'safe' | 'caution' | 'danger';
  if (willOverdraft) verdict = 'danger';
  else if (affectsSavings) verdict = 'caution';
  else verdict = 'safe';

  return c.json({ success: true, data: { amount, verdict, willOverdraft, affectsSavings, affectedGoals, minBalance } });
});

// POST /forecast/settle — 單筆預測事件勾選／取消已繳 (ADR 0018 + ADR 0013 權限防線)
forecast.post('/settle', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  await ensureForecastSchema(c.env.DB);
  const { event_key, settled } = await c.req.json();
  if (!event_key || typeof event_key !== 'string') {
    return c.json({ success: false, error: '缺少 event_key' }, 400);
  }

  const parts = event_key.split(':');
  const kind = parts[0];
  const targetId = parts[1];
  if ((kind !== 'recurring' && kind !== 'card_due') || !targetId) {
    return c.json({ success: false, error: '無效的 event_key 格式' }, 400);
  }

  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  if (kind === 'recurring') {
    const rec = await c.env.DB.prepare(
      `SELECT user_id, is_shared FROM recurring_items WHERE id = ? AND user_id IN (${placeholders})`
    ).bind(targetId, ...memberUserIds).first<any>();
    if (!rec) return c.json({ success: false, error: '找不到對應的週期收支項目' }, 404);
    if ((rec.is_shared === 0 || !rec.is_shared) && rec.user_id !== userId) {
      return c.json({ success: false, error: '權限不足：個人私帳預測事件僅限本人勾選已繳' }, 403);
    }
    if (rec.is_shared === 1 && rec.user_id !== userId && myRole !== 'admin') {
      return c.json({ success: false, error: '權限不足：家庭公帳預測事件僅限建立者本人或家庭管理員勾選已繳' }, 403);
    }
  } else if (kind === 'card_due') {
    const card = await c.env.DB.prepare(
      `SELECT user_id, is_joint FROM accounts WHERE id = ? AND type = 'credit_card' AND user_id IN (${placeholders})`
    ).bind(targetId, ...memberUserIds).first<any>();
    if (!card) return c.json({ success: false, error: '找不到對應的信用卡帳戶' }, 404);
    if (card.user_id !== userId && myRole !== 'admin') {
      return c.json({ success: false, error: '權限不足：他人信用卡繳款事件僅限持卡人本人或家庭管理員勾選已繳' }, 403);
    }
  }

  if (settled) {
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO forecast_settled_events (event_key, user_id) VALUES (?, ?)'
    ).bind(event_key, userId).run();
  } else {
    await c.env.DB.prepare(
      'DELETE FROM forecast_settled_events WHERE event_key = ?'
    ).bind(event_key).run();
  }

  return c.json({ success: true, data: { event_key, is_settled: Boolean(settled) } });
});

export default forecast;
