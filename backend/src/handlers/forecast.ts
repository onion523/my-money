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

// 試算第 0 天起始基準可用餘額 (對齊 ADR 0015 帳戶權責會計)
async function getForecastStartingBalance(db: any, userId: string, scope: string, memberUserIds: string[]) {
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
  const accList = allAccounts.results as Array<{ type: string; balance: number; unbilled: number }>;
  const cashTotal = accList.filter(a => a.type === 'cash').reduce((s, a) => s + (a.balance || 0), 0);
  const bankTotal = accList.filter(a => a.type === 'bank').reduce((s, a) => s + (a.balance || 0), 0);
  const ccBilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + (a.balance || 0), 0);
  let ccUnbilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + (a.unbilled || 0), 0);

  // ADR 0015 精準會計責任法：在公帳與全部視角下，扣除私卡代墊公帳欠款 (shared_debt)
  if (scope === 'household' || scope === 'all') {
    const cardCondition = scope === 'household'
      ? `user_id IN (${placeholders}) AND is_joint = 0 AND type = 'credit_card'`
      : `user_id IN (${placeholders}) AND user_id != ? AND is_joint = 0 AND type = 'credit_card'`;
    const cardParams = scope === 'household' ? memberUserIds : [...memberUserIds, userId];

    const personalCards = await db.prepare(
      `SELECT id, balance, unbilled FROM accounts WHERE ${cardCondition}`
    ).bind(...cardParams).all();
    const cardResults = (personalCards.results || []) as Array<{ id: string; balance: number; unbilled: number }>;

    for (const card of cardResults) {
      const totalDue = (card.balance || 0) + (card.unbilled || 0);
      if (totalDue <= 0) continue;
      const txs = await db.prepare(
        "SELECT amount, is_shared FROM transactions WHERE account_id = ? AND type = 'expense' ORDER BY date DESC, created_at DESC LIMIT 50"
      ).bind(card.id).all();
      const txResults = (txs.results || []) as Array<{ amount: number; is_shared: number }>;
      let remaining = totalDue;
      let cardShared = 0;
      for (const tx of txResults) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, tx.amount);
        if (tx.is_shared === 1) cardShared += take;
        remaining -= take;
      }
      ccUnbilled += cardShared;
    }
  }

  const available = cashTotal + bankTotal - ccBilled - ccUnbilled;
  return { available, cashTotal, bankTotal, ccBilled, ccUnbilled };
}

// GET /forecast (支援 scope = all | household | personal)
forecast.get('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available } = await getForecastStartingBalance(c.env.DB, userId, scope, memberUserIds);
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
  const events = getDaysInForecast(items, 30);

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

  const { available } = await getForecastStartingBalance(c.env.DB, userId, scope, memberUserIds);
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
  const events = getDaysInForecast(items, 30);
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
