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

export interface ForecastEvent {
  date: string;
  name: string;
  type: string;
  amount: number;
  is_shared: number;
  account_name?: string;
}

function getDaysInForecast(items: (RecurringItem & { account_name?: string; is_shared?: number })[], days = 30): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  const forecastDays = getTaipeiForecastDays(days);

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
        events.push({
          date: dayObj.dateStr,
          name: item.name,
          type: item.type,
          amount: item.amount,
          is_shared: item.is_shared ?? 0,
          account_name: item.account_name || undefined
        });
      }
    }
  }
  return events;
}

// 試算第 0 天起始基準可用餘額與信用卡繳卡費事件 (ADR 0015 權責會計 + ADR 0017 繳卡費事件)
async function getForecastStartingBalance(db: any, userId: string, scope: string, memberUserIds: string[], days = 30) {
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

  // 信用卡：依視角計算「歸屬本視角之比例」，已出帳於繳款日扣除、未出帳於起始餘額預扣
  const cardRows = await db.prepare(
    `SELECT id, user_id, name, balance, unbilled, is_joint, payment_due_day FROM accounts WHERE type = 'credit_card' AND (user_id = ? OR user_id IN (${placeholders}))`
  ).bind(userId, ...memberUserIds).all();
  const cards = (cardRows.results || []) as Array<{
    id: string; user_id: string; name: string; balance: number; unbilled: number; is_joint: number; payment_due_day: number | null;
  }>;

  const forecastDays = getTaipeiForecastDays(days);
  const findDueDate = (dueDay: number): string | null => {
    for (const d of forecastDays) {
      const maxDays = new Date(d.year, d.month, 0).getDate();
      if (d.day === Math.min(dueDay, maxDays)) return d.dateStr;
    }
    return null;
  };

  let unbilledDeduct = 0;
  let billedImmediate = 0;
  const cardEvents: ForecastEvent[] = [];

  for (const card of cards) {
    const isOwn = card.user_id === userId;
    const isJoint = card.is_joint === 1;
    const totalDue = (card.balance || 0) + (card.unbilled || 0);
    let fraction = 1;

    if (isJoint) {
      fraction = scope === 'personal' ? 0 : 1;
    } else if (scope === 'all' && isOwn) {
      fraction = 1;
    } else if (scope === 'personal' && !isOwn) {
      fraction = 0;
    } else if (totalDue <= 0) {
      fraction = 0;
    } else {
      // 私卡公私拆分：沿用帳戶管理 shared_debt 分配法（最近 50 筆支出）
      const txs = await db.prepare(
        "SELECT amount, is_shared FROM transactions WHERE account_id = ? AND type = 'expense' ORDER BY date DESC, created_at DESC LIMIT 50"
      ).bind(card.id).all();
      let remaining = totalDue;
      let shared = 0;
      for (const tx of ((txs.results || []) as Array<{ amount: number; is_shared: number }>)) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, tx.amount);
        if (tx.is_shared === 1) shared += take;
        remaining -= take;
      }
      const ratio = shared / totalDue;
      fraction = scope === 'personal' ? 1 - ratio : ratio;
    }

    if (fraction <= 0) continue;
    const billed = (card.balance || 0) * fraction;
    unbilledDeduct += (card.unbilled || 0) * fraction;
    if (billed <= 0) continue;

    const dueDate = card.payment_due_day ? findDueDate(card.payment_due_day) : null;
    if (dueDate) {
      cardEvents.push({
        date: dueDate,
        name: `💳 繳卡費 · ${card.name}`,
        type: 'expense',
        amount: Math.round(billed * 100) / 100,
        is_shared: isJoint || !isOwn || scope === 'household' ? 1 : 0,
        account_name: card.name,
      });
    } else {
      billedImmediate += billed;
    }
  }

  const available = cashTotal + bankTotal - unbilledDeduct - billedImmediate;
  return { available, cashTotal, bankTotal, cardEvents };
}

// GET /forecast (支援 scope = all | household | personal)
forecast.get('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available, cardEvents } = await getForecastStartingBalance(c.env.DB, userId, scope, memberUserIds);
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
    SELECT r.*, a.name as account_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE ${recCondition}
    ORDER BY r.created_at ASC
  `).bind(...recParams).all();

  const items = recRows.results as unknown as (RecurringItem & { account_name?: string })[];
  const events = [...getDaysInForecast(items, 30), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));

  // 逐日模擬
  const forecastDays = getTaipeiForecastDays(30);
  const dailyBalances: Array<{ date: string; balance: number; events: ForecastEvent[] }> = [];
  let minBalance = balance;
  let minDate = forecastDays[0]?.dateStr || '';

  for (let d = 0; d < 30; d++) {
    const dateStr = forecastDays[d].dateStr;
    const dayEvents = events.filter(e => e.date === dateStr);
    dayEvents.forEach(e => { balance += e.type === 'income' ? e.amount : -e.amount; });
    if (balance < minBalance) { minBalance = balance; minDate = dateStr; }
    dailyBalances.push({ date: dateStr, balance: Math.round(balance * 100) / 100, events: dayEvents });
  }

  return c.json({
    success: true,
    data: {
      dailyBalances,
      minBalance,
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
  const { amount, scope = 'all' } = await c.req.json();
  if (!amount || amount <= 0) return c.json({ success: false, error: '請輸入有效金額' }, 400);

  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available, cardEvents } = await getForecastStartingBalance(c.env.DB, userId, scope, memberUserIds);
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

  // 30天現金流
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
    SELECT r.*, a.name as account_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE ${recCondition}
    ORDER BY r.created_at ASC
  `).bind(...recParams).all();

  const items = recRows.results as unknown as (RecurringItem & { account_name?: string })[];
  const events = [...getDaysInForecast(items, 30), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));
  let minBalance = balance;
  events.forEach(e => {
    balance += e.type === 'income' ? e.amount : -e.amount;
    if (balance < minBalance) minBalance = balance;
  });

  const willOverdraft = minBalance < 0;
  let verdict: 'safe' | 'caution' | 'danger';
  if (willOverdraft) verdict = 'danger';
  else if (affectsSavings) verdict = 'caution';
  else verdict = 'safe';

  return c.json({ success: true, data: { amount, verdict, willOverdraft, affectsSavings, affectedGoals, minBalance } });
});

export default forecast;
