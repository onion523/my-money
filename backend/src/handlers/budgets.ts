import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';

type Vars = { userId: string; userEmail: string; userName: string };
const budgets = new Hono<{ Bindings: Env; Variables: Vars }>();
budgets.use('*', authMiddleware);

// GET /budgets?month=YYYY-MM
budgets.get('/', async (c) => {
  const userId = c.get('userId');
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const budgetRows = await c.env.DB.prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ?').bind(userId, month).all();
  const spendRows = await c.env.DB.prepare(
    "SELECT category, SUM(amount) as spent FROM transactions WHERE user_id = ? AND date LIKE ? AND type='expense' GROUP BY category"
  ).bind(userId, `${month}%`).all();
  const spentMap: Record<string, number> = {};
  (spendRows.results as Array<{ category: string; spent: number }>).forEach(r => { spentMap[r.category] = r.spent; });
  const result = (budgetRows.results as Array<{ id: string; category: string; amount: number; month: string }>).map(b => ({
    ...b, spent: spentMap[b.category] || 0, over: (spentMap[b.category] || 0) > b.amount
  }));
  return c.json({ success: true, data: result });
});

// PUT /budgets — upsert
budgets.put('/', async (c) => {
  const userId = c.get('userId');
  const { category, amount, month } = await c.req.json();
  if (!category || !amount || !month) return c.json({ success: false, error: '請填寫所有欄位' }, 400);
  const existing = await c.env.DB.prepare('SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ?').bind(userId, category, month).first<{ id: string }>();
  if (existing) {
    await c.env.DB.prepare('UPDATE budgets SET amount = ? WHERE id = ?').bind(amount, existing.id).run();
  } else {
    const id = generateId();
    await c.env.DB.prepare('INSERT INTO budgets (id, user_id, category, amount, month) VALUES (?, ?, ?, ?, ?)').bind(id, userId, category, amount, month).run();
  }
  const row = await c.env.DB.prepare('SELECT * FROM budgets WHERE user_id = ? AND category = ? AND month = ?').bind(userId, category, month).first();
  return c.json({ success: true, data: row });
});

export default budgets;
