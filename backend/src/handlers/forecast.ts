import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware } from '../middleware/jwt';
import { getTaipeiDateString, getTaipeiForecastDays } from '../utils/date';

type Vars = { userId: string; userEmail: string; userName: string };
const forecast = new Hono<{ Bindings: Env; Variables: Vars }>();
forecast.use('*', authMiddleware);

const CYCLE_MONTHS: Record<string, number> = { monthly:1, bimonthly:2, quarterly:3, semiannual:6, annual:12 };

function getDaysInForecast(items: RecurringItem[], days = 30): Array<{ date: string; name: string; type: string; amount: number }> {
  const events: Array<{ date: string; name: string; type: string; amount: number }> = [];
  const forecastDays = getTaipeiForecastDays(days);

  for (const dayObj of forecastDays) {
    const dom = dayObj.day;
    const month = dayObj.month;
    for (const item of items) {
      const cycleM = CYCLE_MONTHS[item.cycle] || 1;
      const trigger = item.day_of_cycle;
      if (dom === trigger && month % cycleM === 0) {
        events.push({ date: dayObj.dateStr, name: item.name, type: item.type, amount: item.amount });
      }
    }
  }
  return events;
}

// GET /forecast
forecast.get('/', async (c) => {
  const userId = c.get('userId');
  const accs = await c.env.DB.prepare('SELECT * FROM accounts WHERE user_id = ?').bind(userId).all();
  const accList = accs.results as Array<{ type: string; balance: number; unbilled: number }>;
  const cashTotal = accList.filter(a => a.type === 'cash').reduce((s, a) => s + a.balance, 0);
  const bankTotal = accList.filter(a => a.type === 'bank').reduce((s, a) => s + a.balance, 0);
  const ccBilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.balance, 0);
  const ccUnbilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.unbilled, 0);
  let balance = cashTotal + bankTotal - ccBilled - ccUnbilled;

  const recRows = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE user_id = ?').bind(userId).all();
  const items = recRows.results as unknown as RecurringItem[];
  const events = getDaysInForecast(items, 30);

  // 逐日模擬
  const forecastDays = getTaipeiForecastDays(30);
  const dailyBalances: Array<{ date: string; balance: number; events: typeof events }> = [];
  let minBalance = balance;
  let minDate = '';

  for (let d = 0; d < 30; d++) {
    const dateStr = forecastDays[d].dateStr;
    const dayEvents = events.filter(e => e.date === dateStr);
    dayEvents.forEach(e => { balance += e.type === 'income' ? e.amount : -e.amount; });
    if (balance < minBalance) { minBalance = balance; minDate = dateStr; }
    dailyBalances.push({ date: dateStr, balance: Math.round(balance * 100) / 100, events: dayEvents });
  }

  return c.json({ success: true, data: { dailyBalances, minBalance, minDate, willOverdraft: minBalance < 0, events } });
});

// POST /forecast/purchase-check
forecast.post('/purchase-check', async (c) => {
  const userId = c.get('userId');
  const { amount } = await c.req.json();
  if (!amount || amount <= 0) return c.json({ success: false, error: '請輸入有效金額' }, 400);

  const accs = await c.env.DB.prepare('SELECT * FROM accounts WHERE user_id = ?').bind(userId).all();
  const accList = accs.results as Array<{ type: string; balance: number; unbilled: number }>;
  const cashTotal = accList.filter(a => a.type === 'cash').reduce((s, a) => s + a.balance, 0);
  const bankTotal = accList.filter(a => a.type === 'bank').reduce((s, a) => s + a.balance, 0);
  const ccBilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.balance, 0);
  const ccUnbilled = accList.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.unbilled, 0);
  let balance = cashTotal + bankTotal - ccBilled - ccUnbilled - amount;

  // 儲蓄目標影響
  const goals = await c.env.DB.prepare('SELECT * FROM goals WHERE user_id = ?').bind(userId).all();
  const goalList = goals.results as Array<{ name: string; saved_amount: number; target_amount: number; monthly_reserve: number }>;
  const affectedGoals = goalList.filter(g => g.monthly_reserve > 0);

  // 30天現金流
  const recRows = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE user_id = ?').bind(userId).all();
  const items = recRows.results as unknown as RecurringItem[];
  const events = getDaysInForecast(items, 30);
  let minBalance = balance;
  events.forEach(e => { balance += e.type === 'income' ? e.amount : -e.amount; if (balance < minBalance) minBalance = balance; });

  const willOverdraft = minBalance < 0;
  const affectsSavings = affectedGoals.length > 0 && (cashTotal + bankTotal - ccBilled - ccUnbilled - amount) < affectedGoals.reduce((s, g) => s + g.monthly_reserve, 0);
  
  let verdict: 'safe' | 'caution' | 'danger';
  if (willOverdraft) verdict = 'danger';
  else if (affectsSavings) verdict = 'caution';
  else verdict = 'safe';

  return c.json({ success: true, data: { amount, verdict, willOverdraft, affectsSavings, affectedGoals, minBalance } });
});

export default forecast;
