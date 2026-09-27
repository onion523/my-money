import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const transactions = new Hono<{ Bindings: Env; Variables: Vars }>();
transactions.use('*', authMiddleware);

// GET /transactions
transactions.get('/', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { category, from, to, limit = '50', offset = '0' } = c.req.query();
  let sql = `SELECT t.*, a.name as account_name, u.name as user_name FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN users u ON t.user_id = u.id WHERE t.user_id IN (${placeholders})`;
  const params: (string | number)[] = [...memberUserIds];
  if (category) { sql += ' AND t.category = ?'; params.push(category); }
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.date <= ?'; params.push(to); }
  sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ success: true, data: rows.results });
});

// POST /transactions
transactions.post('/', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { account_id, type, category, amount, note = '', date } = await c.req.json();
  if (!account_id || !type || !category || !amount || !date) return c.json({ success: false, error: '請填寫所有必填欄位' }, 400);
  
  const acc = await c.env.DB.prepare(`SELECT id, type FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(account_id, ...memberUserIds).first<{ id: string; type: string }>();
  if (!acc) return c.json({ success: false, error: '帳戶不存在' }, 404);

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, account_id, type, category, amount, note, date).run();

  // 更新帳戶餘額
  const amt = Number(amount);
  if (acc.type === 'bank') {
    const delta = type === 'income' ? amt : -amt;
    await c.env.DB.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(delta, account_id).run();
  } else {
    const delta = type === 'expense' ? amt : -amt;
    await c.env.DB.prepare('UPDATE accounts SET unbilled = MAX(0, unbilled + ?) WHERE id = ?').bind(delta, account_id).run();
  }

  const row = await c.env.DB.prepare(`
    SELECT t.*, a.name as account_name, u.name as user_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

// PUT /transactions/:id
transactions.put('/:id', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const id = c.req.param('id');
  const { account_id, type, category, amount, note = '', date } = await c.req.json();
  if (!account_id || !type || !category || !amount || !date) return c.json({ success: false, error: '請填寫所有必填欄位' }, 400);

  const existing = await c.env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first();
  if (!existing) return c.json({ success: false, error: '交易記錄不存在' }, 404);

  await c.env.DB.prepare('UPDATE transactions SET account_id = ?, type = ?, category = ?, amount = ?, note = ?, date = ? WHERE id = ?')
    .bind(account_id, type, category, amount, note, date, id).run();

  const row = await c.env.DB.prepare(`
    SELECT t.*, a.name as account_name, u.name as user_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).bind(id).first();
  return c.json({ success: true, data: row });
});

// DELETE /transactions/:id
transactions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first();
  if (!existing) return c.json({ success: false, error: '交易記錄不存在' }, 404);

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: null });
});

// GET /transactions/summary/category?month=YYYY-MM
transactions.get('/summary/category', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const rows = await c.env.DB.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE user_id IN (${placeholders}) AND type = 'expense' AND date LIKE ?
    GROUP BY category ORDER BY total DESC
  `).bind(...memberUserIds, `${month}%`).all();
  return c.json({ success: true, data: rows.results });
});

// GET /transactions/summary/monthly?year=YYYY
transactions.get('/summary/monthly', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const year = c.req.query('year') || new Date().getFullYear().toString();
  const rows = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total
    FROM transactions
    WHERE user_id IN (${placeholders}) AND date LIKE ?
    GROUP BY month, type ORDER BY month ASC
  `).bind(...memberUserIds, `${year}%`).all();
  return c.json({ success: true, data: rows.results });
});

export default transactions;
