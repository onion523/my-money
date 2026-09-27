import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const accounts = new Hono<{ Bindings: Env; Variables: Vars }>();
accounts.use('*', authMiddleware);

// GET /accounts
accounts.get('/', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const rows = await c.env.DB.prepare(`
    SELECT a.*, u.name as owner_name
    FROM accounts a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.user_id IN (${placeholders})
    ORDER BY a.created_at ASC
  `).bind(...memberUserIds).all();
  return c.json({ success: true, data: rows.results });
});

// POST /accounts
accounts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { name, type, balance = 0, credit_limit, statement_day, payment_due_day, unbilled = 0, color = '#FF8A8A' } = body;
  if (!name || !type) return c.json({ success: false, error: '請填寫帳戶名稱和類型' }, 400);
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO accounts (id, user_id, name, type, balance, credit_limit, statement_day, payment_due_day, unbilled, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, name, type, balance, credit_limit ?? null, statement_day ?? null, payment_due_day ?? null, unbilled, color).run();
  const row = await c.env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

// PUT /accounts/:id
accounts.put('/:id', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, balance, credit_limit, statement_day, payment_due_day, unbilled, color } = body;
  const existing = await c.env.DB.prepare(`SELECT id FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first();
  if (!existing) return c.json({ success: false, error: '帳戶不存在' }, 404);
  await c.env.DB.prepare(
    'UPDATE accounts SET name = ?, balance = ?, credit_limit = ?, statement_day = ?, payment_due_day = ?, unbilled = ?, color = ? WHERE id = ?'
  ).bind(name, balance, credit_limit ?? null, statement_day ?? null, payment_due_day ?? null, unbilled, color, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

// DELETE /accounts/:id
accounts.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare(`SELECT id FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first();
  if (!existing) return c.json({ success: false, error: '帳戶不存在' }, 404);
  await c.env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: null });
});

// GET /accounts/balance — 即時可用餘額
accounts.get('/balance', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const allAccounts = await c.env.DB.prepare(`SELECT * FROM accounts WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all();
  const accs = allAccounts.results as Array<{ type: string; balance: number; unbilled: number }>;
  const bankTotal = accs.filter(a => a.type === 'bank').reduce((s, a) => s + a.balance, 0);
  const ccBilled = accs.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.balance, 0);
  const ccUnbilled = accs.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.unbilled, 0);
  const available = bankTotal - ccBilled - ccUnbilled;

  // 固定支出月攤提
  const recurring = await c.env.DB.prepare(`SELECT * FROM recurring_items WHERE user_id IN (${placeholders}) AND type = 'expense'`).bind(...memberUserIds).all();
  const cycleMonths: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };
  const monthlyFixed = (recurring.results as Array<{ amount: number; cycle: string }>)
    .reduce((s, r) => s + r.amount / (cycleMonths[r.cycle] || 1), 0);

  // 儲蓄目標月預留
  const goals = await c.env.DB.prepare(`SELECT monthly_reserve FROM goals WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all();
  const monthlyGoals = (goals.results as Array<{ monthly_reserve: number }>).reduce((s, g) => s + g.monthly_reserve, 0);

  const disposable = available - monthlyFixed - monthlyGoals;
  return c.json({ success: true, data: { bankTotal, ccBilled, ccUnbilled, available, monthlyFixed, monthlyGoals, disposable } });
});

export default accounts;