import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const recurring = new Hono<{ Bindings: Env; Variables: Vars }>();
recurring.use('*', authMiddleware);

const CYCLE_MONTHS: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };

let recurringMigrated = false;
export async function ensureRecurringSchema(db: any) {
  if (recurringMigrated) return;
  try {
    await db.prepare('ALTER TABLE recurring_items ADD COLUMN month_of_cycle INTEGER NOT NULL DEFAULT 1').run();
  } catch (_) {}
  try {
    await db.prepare('ALTER TABLE recurring_items ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0').run();
    // 自動平滑升級：若先前已綁定家庭共同帳戶 (is_joint = 1)，自動升級為公帳 (is_shared = 1)
    await db.prepare(`
      UPDATE recurring_items
      SET is_shared = 1
      WHERE account_id IN (SELECT id FROM accounts WHERE is_joint = 1)
    `).run();
  } catch (_) {}
  recurringMigrated = true;
}

// GET /recurring (支援 scope = all | household | personal)
recurring.get('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  let sqlCondition = `(r.user_id = ? OR (r.user_id IN (${placeholders}) AND r.is_shared = 1))`;
  let sqlParams: any[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    sqlCondition = `r.user_id IN (${placeholders}) AND r.is_shared = 1`;
    sqlParams = [...memberUserIds];
  } else if (scope === 'personal') {
    sqlCondition = `r.user_id = ? AND r.is_shared = 0`;
    sqlParams = [userId];
  }

  const rows = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.is_joint as account_is_joint, u.name as user_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE ${sqlCondition}
    ORDER BY r.created_at ASC
  `).bind(...sqlParams).all();
  return c.json({ success: true, data: rows.results });
});

// POST /recurring
recurring.post('/', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const { name, type, amount, cycle, day_of_cycle = 1, month_of_cycle = 1, account_id, is_shared = 0 } = await c.req.json();
  if (!name || !type || !amount || !cycle) return c.json({ success: false, error: '請填寫所有必填欄位' }, 400);
  const id = generateId();
  const sharedFlag = Number(is_shared) ? 1 : 0;
  await c.env.DB.prepare(
    'INSERT INTO recurring_items (id, user_id, account_id, name, type, amount, cycle, day_of_cycle, month_of_cycle, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, account_id ?? null, name, type, amount, cycle, day_of_cycle, month_of_cycle ?? 1, sharedFlag).run();

  const row = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.is_joint as account_is_joint, u.name as user_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `).bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

// PUT /recurring/:id
recurring.put('/:id', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const { id } = c.req.param();
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const existing = await c.env.DB.prepare(
    `SELECT * FROM recurring_items WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first<any>();

  if (!existing) return c.json({ success: false, error: '項目不存在' }, 404);

  // 權限檢查 (ADR 0013 & ADR 0016)：
  // 個人私帳週期項目 (is_shared = 0) 僅限建立者本人修改
  if (existing.is_shared === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳週期項目僅限建立者本人修改' }, 403);
  }
  // 家庭公帳週期項目 (is_shared = 1) 僅限建立者本人或家庭管理員修改
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：他人建立之家庭公帳週期項目僅限該建立者或家庭管理員修改' }, 403);
  }

  const { name, type, amount, cycle, day_of_cycle, month_of_cycle = 1, account_id, is_shared } = await c.req.json();
  const sharedFlag = is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : existing.is_shared;

  await c.env.DB.prepare('UPDATE recurring_items SET name=?, type=?, amount=?, cycle=?, day_of_cycle=?, month_of_cycle=?, account_id=?, is_shared=? WHERE id=?')
    .bind(name, type, amount, cycle, day_of_cycle, month_of_cycle ?? 1, account_id ?? null, sharedFlag, id).run();

  const row = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.is_joint as account_is_joint, u.name as user_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `).bind(id).first();
  return c.json({ success: true, data: row });
});

// DELETE /recurring/:id
recurring.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const existing = await c.env.DB.prepare(
    `SELECT * FROM recurring_items WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first<any>();

  if (!existing) return c.json({ success: false, error: '項目不存在' }, 404);

  // 權限檢查 (ADR 0013 & ADR 0016)：
  if (existing.is_shared === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳週期項目僅限建立者本人刪除' }, 403);
  }
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：他人建立之家庭公帳週期項目僅限該建立者或家庭管理員刪除' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM recurring_items WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: null });
});

// GET /recurring/amortize — 固定支出月攤提合計 (支援 scope = all | household | personal)
recurring.get('/amortize', async (c) => {
  const userId = c.get('userId');
  await ensureRecurringSchema(c.env.DB);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  let sqlCondition = `(r.user_id = ? OR (r.user_id IN (${placeholders}) AND r.is_shared = 1))`;
  let sqlParams: any[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    sqlCondition = `r.user_id IN (${placeholders}) AND r.is_shared = 1`;
    sqlParams = [...memberUserIds];
  } else if (scope === 'personal') {
    sqlCondition = `r.user_id = ? AND r.is_shared = 0`;
    sqlParams = [userId];
  }

  const rows = await c.env.DB.prepare(`
    SELECT r.*, a.name as account_name, a.is_joint as account_is_joint, u.name as user_name
    FROM recurring_items r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE ${sqlCondition}
    ORDER BY r.created_at ASC
  `).bind(...sqlParams).all();

  const items = rows.results as unknown as RecurringItem[];
  const monthly = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount / (CYCLE_MONTHS[i.cycle] || 1), 0);
  const income = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount / (CYCLE_MONTHS[i.cycle] || 1), 0);
  return c.json({ success: true, data: { monthly_expense: monthly, monthly_income: income, items } });
});

export default recurring;
