import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const transactions = new Hono<{ Bindings: Env; Variables: Vars }>();
transactions.use('*', authMiddleware);

function buildScopeCondition(userId: string, memberUserIds: string[], scope?: string): { condition: string; params: string[] } {
  const placeholders = memberUserIds.map(() => '?').join(',');
  if (scope === 'personal') {
    return { condition: 't.user_id = ?', params: [userId] };
  } else if (scope === 'household') {
    return { condition: `t.user_id IN (${placeholders}) AND t.is_shared = 1`, params: [...memberUserIds] };
  } else {
    // 'all': my own (shared + private) + other household members' shared
    return { condition: `(t.user_id = ? OR (t.user_id IN (${placeholders}) AND t.is_shared = 1))`, params: [userId, ...memberUserIds] };
  }
}

// GET /transactions
transactions.get('/', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const { category, from, to, scope = 'all', limit = '50', offset = '0' } = c.req.query();

  const { condition, params: scopeParams } = buildScopeCondition(userId, memberUserIds, scope);

  let sql = `SELECT t.*, a.name as account_name, u.name as user_name FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN users u ON t.user_id = u.id WHERE ${condition}`;
  const params: (string | number)[] = [...scopeParams];

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

  const body = await c.req.json();
  const { account_id, type, category, amount, note = '', date } = body;
  const is_shared = body.is_shared !== undefined ? (Number(body.is_shared) ? 1 : 0) : 1;

  if (!account_id || !type || !category || !amount || !date) {
    return c.json({ success: false, error: '請填寫必填欄位' }, 400);
  }
  
  const acc = await c.env.DB.prepare(
    `SELECT id, type FROM accounts WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(account_id, ...memberUserIds).first<{ id: string; type: string }>();

  if (!acc) return c.json({ success: false, error: '帳戶不存在' }, 404);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, account_id, type, category, amount, note, date, is_shared).run();

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
  const body = await c.req.json();
  const { account_id, type, category, amount, note = '', date } = body;
  const is_shared = body.is_shared !== undefined ? (Number(body.is_shared) ? 1 : 0) : 1;

  if (!account_id || !type || !category || !amount || !date) {
    return c.json({ success: false, error: '請填寫必填欄位' }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT * FROM transactions WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first();

  if (!existing) return c.json({ success: false, error: '紀錄不存在' }, 404);

  // Q5: 信用卡還款紀錄受保護
  if (existing.category === '信用卡還款') {
    return c.json({
      success: false,
      error: '「信用卡還款」為系統內部平帳紀錄，受系統保護禁止直接修改。若金額有誤，請至「帳戶管理」直接校正銀行或卡片餘額。'
    }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE transactions SET account_id = ?, type = ?, category = ?, amount = ?, note = ?, date = ?, is_shared = ? WHERE id = ?'
  ).bind(account_id, type, category, amount, note, date, is_shared, id).run();

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
  const existing = await c.env.DB.prepare(
    `SELECT * FROM transactions WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first();

  if (!existing) return c.json({ success: false, error: '紀錄不存在' }, 404);

  // Q5: 信用卡還款紀錄受保護
  if (existing.category === '信用卡還款') {
    return c.json({
      success: false,
      error: '「信用卡還款」為系統內部平帳紀錄，受系統保護禁止直接刪除。若金額有誤，請至「帳戶管理」直接校正銀行或卡片餘額。'
    }, 400);
  }

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: null });
});

// GET /transactions/summary/category?month=YYYY-MM&scope=all|household|personal
transactions.get('/summary/category', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const scope = c.req.query('scope') || 'all';

  const { condition, params } = buildScopeCondition(userId, memberUserIds, scope);

  const rows = await c.env.DB.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions t
    WHERE ${condition} AND t.type = 'expense' AND t.category != '信用卡還款' AND t.date LIKE ?
    GROUP BY category ORDER BY total DESC
  `).bind(...params, `${month}%`).all();
  return c.json({ success: true, data: rows.results });
});

// GET /transactions/summary/monthly?year=YYYY&scope=all|household|personal
transactions.get('/summary/monthly', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const scope = c.req.query('scope') || 'all';

  const { condition, params } = buildScopeCondition(userId, memberUserIds, scope);

  const rows = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total
    FROM transactions t
    WHERE ${condition} AND t.category != '信用卡還款' AND t.date LIKE ?
    GROUP BY month, type ORDER BY month ASC
  `).bind(...params, `${year}%`).all();
  return c.json({ success: true, data: rows.results });
});

// GET /transactions/summary/household-shares?month=YYYY-MM
transactions.get('/summary/household-shares', async (c) => {
  const userId = c.get('userId');
  const { household, memberUserIds } = await getUserHousehold(c.env.DB, userId);
  if (!household) {
    return c.json({ success: true, data: [] });
  }

  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const rows = await c.env.DB.prepare(`
    SELECT t.user_id, u.name as user_name, SUM(t.amount) as total
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.user_id IN (${placeholders}) AND t.is_shared = 1 AND t.type = 'expense' AND t.category != '信用卡還款' AND t.date LIKE ?
    GROUP BY t.user_id, u.name
    ORDER BY total DESC
  `).bind(...memberUserIds, `${month}%`).all();

  return c.json({ success: true, data: rows.results });
});

export default transactions;
