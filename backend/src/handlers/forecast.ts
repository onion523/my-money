import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware } from '../middleware/jwt';
import { getTaipeiForecastDays } from '../utils/date';
import { getUserHousehold } from './households';
import { ensureRecurringSchema } from './recurring';

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
}

export interface ForecastRecurringItem extends RecurringItem {
  account_name?: string;
  account_type?: string;
  statement_day?: number | null;
  payment_due_day?: number | null;
  is_shared?: number;
}

export function calculateCreditCardDueDate(
  chargeYear: number,
  chargeMonth: number,
  chargeDay: number,
  statementDay: number | null,
  paymentDueDay: number
): { year: number; month: number; day: number; dateStr: string } {
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
  return { year: dueYear, month: dueMonth, day: actualDueDay, dateStr };
}

const FORECAST_DAYS = 60;

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

  for (const dayObj of forecastDays) {
    const dom = dayObj.day;
    const month = dayObj.month;
    const year = dayObj.year;

    // 計算該年該月實際最大天數（支援平年 28、閏年 29、大小月 30/31 天）
    const maxDaysInMonth = new Date(year, month, 0).getDate();

    for (const item of items) {
      const cycleM = CYCLE_MONTHS[item.cycle] || 1;
      const anchorM = item.month_of_cycle || 1;
      const monthDiff = month - anchorM;
      const isCycleMonth = ((monthDiff % cycleM) + cycleM) % cycleM === 0;

      // 月底天數平貼：若扣款日大於該月最大天數，自動平貼至該月最後一日
      const targetDay = Math.min(item.day_of_cycle, maxDaysInMonth);

      if (isCycleMonth && dom === targetDay) {
        const isShared = item.is_shared ?? 0;
        const canSettle = isShared === 0 ? item.user_id === userId : (item.user_id === userId || myRole === 'admin');

        if (item.account_type === 'credit_card' && item.payment_due_day) {
          // 信用卡扣款週期收支：平移至該卡所屬之信用卡繳款日 (Payment Due Day)
          const due = calculateCreditCardDueDate(year, month, targetDay, item.statement_day ?? null, item.payment_due_day);
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
          const eventKey = `recurring:${item.id}:${dayObj.dateStr}`;
          events.push({
            event_key: eventKey,
            date: dayObj.dateStr,
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
  return events;
}

// 試算第 0 天起始基準可用餘額與信用卡繳卡費事件 (60 天期程：已出帳排入最近扣繳日，未出帳排入下次結帳日出帳後之扣繳日)
async function getForecastStartingBalance(
  db: any,
  userId: string,
  scope: string,
  memberUserIds: string[],
  days = FORECAST_DAYS,
  settledKeys: Set<string> = new Set(),
  myRole: string | null = 'member'
) {
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
    `SELECT id, user_id, name, balance, unbilled, is_joint, statement_day, payment_due_day FROM accounts WHERE type = 'credit_card' AND (user_id = ? OR user_id IN (${placeholders}))`
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
  }>;

  const forecastDays = getTaipeiForecastDays(days);
  const minDateStr = forecastDays[0].dateStr;
  const maxDateStr = forecastDays[forecastDays.length - 1].dateStr;

  // 尋找自今日起最近一次即將到來的扣繳日（供已出帳 balance 使用）
  const findFirstDueDate = (dueDay: number): string | null => {
    for (const d of forecastDays) {
      const maxDays = new Date(d.year, d.month, 0).getDate();
      if (d.day === Math.min(dueDay, maxDays)) return d.dateStr;
    }
    return null;
  };

  // 尋找下一次結帳日出帳後的第一個扣繳日（供未出帳 unbilled 使用）
  const findUnbilledDueDate = (
    statementDay: number | null,
    paymentDueDay: number,
    hasBilledBalance: boolean,
    billedDueDate: string | null
  ): string | null => {
    const todayObj = forecastDays[0];
    const stmtDay = statementDay || 20;
    const maxDaysInTodayMonth = new Date(todayObj.year, todayObj.month, 0).getDate();
    const clampedTodayStmtDay = Math.min(stmtDay, maxDaysInTodayMonth);

    let stmtYear = todayObj.year;
    let stmtMonth = todayObj.month;

    // 若今日已過本月結帳日，或當期已有已出帳待繳餘額（代表本期已出帳），則未出帳歸屬於下月結帳日
    if (todayObj.day > clampedTodayStmtDay || hasBilledBalance) {
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

    // 防重疊保護：若該卡有已出帳排程且推算出的未出帳扣繳日未晚於已出帳扣繳日，自動推進至下一期結帳週期
    if (billedDueDate && due.dateStr <= billedDueDate) {
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

    if (due.dateStr >= minDateStr && due.dateStr <= maxDateStr) {
      return due.dateStr;
    }
    return null;
  };

  let immediateCardDeduct = 0;
  const cardEvents: ForecastEvent[] = [];

  const cardsNeedingSplit = cards.filter(c => {
    const totalDue = Math.max(0, c.balance || 0) + Math.max(0, c.unbilled || 0);
    if (totalDue <= 0) return false;
    if (c.is_joint === 1) return false;
    if (scope === 'all' && c.user_id === userId) return false;
    if (scope === 'personal' && c.user_id !== userId) return false;
    return true;
  });

  const txsByCard = new Map<string, Array<{ amount: number; is_shared: number; is_billed: number }>>();
  if (cardsNeedingSplit.length > 0) {
    const cardPlaceholders = cardsNeedingSplit.map(() => '?').join(',');
    const batchTxs = await db.prepare(
      `SELECT account_id, amount, is_shared, COALESCE(is_billed, 0) as is_billed FROM transactions WHERE account_id IN (${cardPlaceholders}) AND type = 'expense' ORDER BY date DESC, created_at DESC`
    ).bind(...cardsNeedingSplit.map(c => c.id)).all();
    for (const row of ((batchTxs.results || []) as Array<{ account_id: string; amount: number; is_shared: number; is_billed: number }>)) {
      let list = txsByCard.get(row.account_id);
      if (!list) {
        list = [];
        txsByCard.set(row.account_id, list);
      }
      if (list.length < 50) list.push(row);
    }
  }

  for (const card of cards) {
    const isOwn = card.user_id === userId;
    const isJoint = card.is_joint === 1;
    const rawBilled = Math.max(0, card.balance || 0);
    const rawUnbilled = Math.max(0, card.unbilled || 0);
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
      // 私卡於公帳或個人私帳視角：依交易之 is_billed 與 is_shared 精確拆分已出帳與未出帳歸屬
      const txList = txsByCard.get(card.id) || [];

      let remUnbilled = rawUnbilled;
      let sharedUnbilled = 0;
      for (const tx of txList.filter(t => t.is_billed === 0)) {
        if (remUnbilled <= 0) break;
        const take = Math.min(remUnbilled, tx.amount);
        if (tx.is_shared === 1) sharedUnbilled += take;
        remUnbilled -= take;
      }

      let remBilled = rawBilled;
      let sharedBilled = 0;
      for (const tx of txList.filter(t => t.is_billed === 1)) {
        if (remBilled <= 0) break;
        const take = Math.min(remBilled, tx.amount);
        if (tx.is_shared === 1) sharedBilled += take;
        remBilled -= take;
      }

      billed = scope === 'household' ? sharedBilled : Math.max(0, rawBilled - sharedBilled);
      unbilled = scope === 'household' ? sharedUnbilled : Math.max(0, rawUnbilled - sharedUnbilled);
    }

    billed = Math.round(billed * 100) / 100;
    unbilled = Math.round(unbilled * 100) / 100;
    if (billed <= 0 && unbilled <= 0) continue;

    const isShared = isJoint || !isOwn || scope === 'household' ? 1 : 0;
    const canSettle = isShared === 0 ? isOwn : (isOwn || myRole === 'admin');

    if (card.payment_due_day) {
      let dueDateBilled: string | null = null;
      if (billed > 0) {
        dueDateBilled = findFirstDueDate(card.payment_due_day);
        if (dueDateBilled) {
          const eventKey = `card_due:${card.id}:${dueDateBilled}`;
          cardEvents.push({
            event_key: eventKey,
            date: dueDateBilled,
            name: `繳卡費 · ${card.name}（已出帳）`,
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
        const dueDateUnbilled = findUnbilledDueDate(
          card.statement_day,
          card.payment_due_day,
          rawBilled > 0,
          dueDateBilled
        );
        if (dueDateUnbilled) {
          const eventKey = `card_due:${card.id}:${dueDateUnbilled}:unbilled`;
          cardEvents.push({
            event_key: eventKey,
            date: dueDateUnbilled,
            name: `繳卡費 · ${card.name}（未出帳）`,
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
  const events = [...getDaysInForecast(items, FORECAST_DAYS, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));

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
  const events = [...getDaysInForecast(items, FORECAST_DAYS, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));
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
