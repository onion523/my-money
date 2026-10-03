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
export async function ensureForecastSchema(db: any) {
  if (forecastSchemaMigrated) return;
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

function getDaysInForecast(
  items: ForecastRecurringItem[],
  days = 30,
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

// 試算第 0 天起始基準可用餘額與信用卡繳卡費事件 (ADR 0015 權責會計 + ADR 0017 繳卡費事件 + ADR 0018 單筆已繳豁免)
async function getForecastStartingBalance(
  db: any,
  userId: string,
  scope: string,
  memberUserIds: string[],
  days = 30,
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
      const eventKey = `card_due:${card.id}:${dueDate}`;
      const isShared = isJoint || !isOwn || scope === 'household' ? 1 : 0;
      const canSettle = isShared === 0 ? isOwn : (isOwn || myRole === 'admin');
      cardEvents.push({
        event_key: eventKey,
        date: dueDate,
        name: `💳 繳卡費 · ${card.name}`,
        type: 'expense',
        amount: Math.round(billed * 100) / 100,
        is_shared: isShared,
        account_name: card.name,
        is_settled: settledKeys.has(eventKey),
        can_settle: canSettle,
      });
    } else {
      billedImmediate += billed;
    }
  }

  const available = cashTotal + bankTotal - unbilledDeduct - billedImmediate;
  return { available, cashTotal, bankTotal, cardEvents };
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

  const { available, cardEvents } = await getForecastStartingBalance(
    c.env.DB, userId, scope, memberUserIds, 30, settledKeys, myRole
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
  const events = [...getDaysInForecast(items, 30, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));

  // 逐日模擬（ADR 0018：已勾選 is_settled 之事件不列入餘額加減）
  const forecastDays = getTaipeiForecastDays(30);
  const dailyBalances: Array<{ date: string; balance: number; events: ForecastEvent[] }> = [];
  let minBalance = balance;
  let minDate = forecastDays[0]?.dateStr || '';

  for (let d = 0; d < 30; d++) {
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
  const settledKeys = await getSettledKeysSet(c.env.DB);
  const { amount, scope = 'all' } = await c.req.json();
  if (!amount || amount <= 0) return c.json({ success: false, error: '請輸入有效金額' }, 400);

  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { available, cardEvents } = await getForecastStartingBalance(
    c.env.DB, userId, scope, memberUserIds, 30, settledKeys, myRole
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

  // 30天現金流（ADR 0018：跳過已勾選 is_settled 之事件）
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
  const events = [...getDaysInForecast(items, 30, settledKeys, userId, myRole), ...cardEvents].sort((x, y) => x.date.localeCompare(y.date));
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
