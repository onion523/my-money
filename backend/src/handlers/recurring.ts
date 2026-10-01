import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';

type Vars = { userId: string; userEmail: string; userName: string };
const recurring = new Hono<{ Bindings: Env; Variables: Vars }>();
recurring.use('*', authMiddleware);

const CYCLE_MONTHS: Record<string, number> = { monthly:1, bimonthly:2, quarterly:3, semiannual:6, annual:12 };

let recurringMigrated = false;
async function ensureRecurringSchema(db: any) {
  if (recurringMigrated) return;
  try {
    await db.prepare('ALTER TABLE recurring_items ADD COLUMN month_of_cycle INTEGER NOT NULL DEFAULT 1').run();
  } catch (_) {}
  recurringMigrated = true;
}

recurring.get('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const rows = await c.env.DB.prepare('SELECT r.*, a.name as account_name FROM recurring_items r LEFT JOIN accounts a ON r.account_id = a.id WHERE r.user_id = ? ORDER BY r.created_at ASC').bind(userId).all();
  return c.json({ success: true, data: rows.results });
});

recurring.post('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const { name, type, amount, cycle, day_of_cycle = 1, month_of_cycle = 1, account_id } = await c.req.json();
  if (!name || !type || !amount || !cycle) return c.json({ success: false, error: '請填寫所有必填欄位' }, 400);
  const id = generateId();
  await c.env.DB.prepare('INSERT INTO recurring_items (id, user_id, account_id, name, type, amount, cycle, day_of_cycle, month_of_cycle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, account_id ?? null, name, type, amount, cycle, day_of_cycle, month_of_cycle ?? 1).run();
  const row = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

recurring.put('/:id', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const { id } = c.req.param();
  const { name, type, amount, cycle, day_of_cycle, month_of_cycle = 1, account_id } = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT id FROM recurring_items WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!existing) return c.json({ success: false, error: '項目不存在' }, 404);
  await c.env.DB.prepare('UPDATE recurring_items SET name=?, type=?, amount=?, cycle=?, day_of_cycle=?, month_of_cycle=?, account_id=? WHERE id=? AND user_id=?')
    .bind(name, type, amount, cycle, day_of_cycle, month_of_cycle ?? 1, account_id ?? null, id, userId).run();
  const row = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

recurring.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM recurring_items WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!existing) return c.json({ success: false, error: '項目不存在' }, 404);
  await c.env.DB.prepare('DELETE FROM recurring_items WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ success: true, data: null });
});

// GET /recurring/amortize — 固定支出月攤提合計
recurring.get('/amortize', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE user_id = ?').bind(userId).all();
  const items = rows.results as unknown as RecurringItem[];
  const monthly = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount / (CYCLE_MONTHS[i.cycle] || 1), 0);
  const income = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount / (CYCLE_MONTHS[i.cycle] || 1), 0);
  return c.json({ success: true, data: { monthly_expense: monthly, monthly_income: income, items } });
});

export default recurring;
