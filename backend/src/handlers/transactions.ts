import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';
import { ensureAccountsSchema, reconcileCreditCardUnbilled } from './accounts';

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
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const { category, from, to, scope = 'all', limit = '50', offset = '0', account_id } = c.req.query();

  const { condition, params: scopeParams } = buildScopeCondition(userId, memberUserIds, scope);

  let sql = `SELECT t.*, a.name as account_name, a.is_joint as account_is_joint, a.type as account_type, u.name as user_name FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN users u ON t.user_id = u.id WHERE ${condition}`;
  const params: (string | number)[] = [...scopeParams];

  if (category) { sql += ' AND t.category = ?'; params.push(category); }
  if (account_id) { sql += ' AND t.account_id = ?'; params.push(account_id); }
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.date <= ?'; params.push(to); }
  sql += ' ORDER BY t.date DESC, t.created_at DESC, t.rowid DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ success: true, data: rows.results });
});

// POST /transactions

// 帳戶餘額與未出帳連動輔助函數 (支援雙層溢出回退與 D1 原子事務 Batch)
async function getSyncAccountStatements(db: any, accountId: string, type: string, amount: number, isRevert: boolean = false) {
  const acc = (await db.prepare('SELECT id, type, balance, unbilled FROM accounts WHERE id = ?').bind(accountId).first()) as { id: string; type: string; balance: number; unbilled: number } | null;
  if (!acc) return [];
  const amt = Number(amount);

  if (acc.type === 'bank' || acc.type === 'cash') {
    const factor = isRevert ? -1 : 1;
    const delta = (type === 'income' ? amt : -amt) * factor;
    return [db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(delta, accountId)];
  } else if (acc.type === 'credit_card') {
    if (isRevert) {
      if (type === 'expense') {
        // 雙層負債溢出回退：優先扣減未出帳，未出帳歸零後溢出扣減已出帳待繳款
        let newUnbilled = acc.unbilled || 0;
        let newBalance = acc.balance || 0;
        if (newUnbilled >= amt) {
          newUnbilled -= amt;
        } else {
          const remainder = amt - newUnbilled;
          newUnbilled = 0;
          newBalance = Math.max(0, newBalance - remainder);
        }
        return [db.prepare('UPDATE accounts SET unbilled = ?, balance = ? WHERE id = ?').bind(newUnbilled, newBalance, accountId)];
      } else {
        return [db.prepare('UPDATE accounts SET unbilled = unbilled + ? WHERE id = ?').bind(amt, accountId)];
      }
    } else {
      if (type === 'expense') {
        return [db.prepare('UPDATE accounts SET unbilled = unbilled + ? WHERE id = ?').bind(amt, accountId)];
      } else {
        let newUnbilled = acc.unbilled || 0;
        let newBalance = acc.balance || 0;
        if (newUnbilled >= amt) {
          newUnbilled -= amt;
        } else {
          const remainder = amt - newUnbilled;
          newUnbilled = 0;
          newBalance = Math.max(0, newBalance - remainder);
        }
        return [db.prepare('UPDATE accounts SET unbilled = ?, balance = ? WHERE id = ?').bind(newUnbilled, newBalance, accountId)];
      }
    }
  }
  return [];
}

transactions.post('/', async (c) => {
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const body = await c.req.json();
  const { account_id, type, category, amount, note = '', date } = body;
  const is_shared = body.is_shared !== undefined ? (Number(body.is_shared) ? 1 : 0) : 1;
  const defer_to_next_statement = body.defer_to_next_statement !== undefined ? (Number(body.defer_to_next_statement) ? 1 : 0) : 0;

  if (!account_id || !type || !category || !amount || !date) {
    return c.json({ success: false, error: '請填寫必填欄位' }, 400);
  }
  
  const acc = await c.env.DB.prepare(
    `SELECT id, type FROM accounts WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(account_id, ...memberUserIds).first<{ id: string; type: string }>();

  if (!acc) return c.json({ success: false, error: '帳戶不存在' }, 404);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared, is_billed, defer_to_next_statement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(id, userId, account_id, type, category, amount, note, date, is_shared, defer_to_next_statement).run();

  if (acc.type === 'credit_card') {
    await reconcileCreditCardUnbilled(c.env.DB, account_id);
  } else {
    const stmts = await getSyncAccountStatements(c.env.DB, account_id, type, amount, false);
    if (stmts.length > 0) await c.env.DB.batch(stmts);
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
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
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
  ).bind(id, ...memberUserIds).first<any>();

  if (!existing) return c.json({ success: false, error: '收支紀錄不存在' }, 404);

  // 權限檢查：
  // 1. 個人私帳收支 (is_shared = 0)：嚴格僅限記錄者本人修改
  if (existing.is_shared === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳收支僅限記錄者本人修改' }, 403);
  }
  // 2. 家庭公帳收支 (is_shared = 1)：採「記錄者本人」或「家庭管理員」共治
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：他人記錄之家庭公帳收支僅限該記錄者或家庭管理員修改' }, 403);
  }

  // Q5: 信用卡還款紀錄受保護
  const protectedCategories = ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'];
  if (protectedCategories.includes(existing.category as string)) {
    return c.json({
      success: false,
      error: `「${existing.category}」為系統內部平帳/轉帳紀錄，受系統保護禁止直接修改。若金額有誤，請至「帳戶管理」進行資金校正。`,
    }, 400);
  }

  // 驗證新帳戶權限
  const newAcc = await c.env.DB.prepare(
    `SELECT id, type FROM accounts WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(account_id, ...memberUserIds).first<{ id: string; type: string }>();
  if (!newAcc) return c.json({ success: false, error: '目標帳戶不存在或無權限' }, 404);

  const oldAcc = existing.account_id === account_id
    ? newAcc
    : await c.env.DB.prepare('SELECT id, type FROM accounts WHERE id = ?').bind(existing.account_id).first<{ id: string; type: string }>();

  // 單卡單一淨差額運算 (Single Net Delta) 或跨帳戶原子同步
  let accountStmts: any[] = [];
  const oldAmt = Number(existing.amount);
  const newAmt = Number(amount);

  if (existing.account_id === account_id) {
    if (newAcc.type === 'bank' || newAcc.type === 'cash') {
      const oldSigned = (existing.type === 'income' ? 1 : -1) * oldAmt;
      const newSigned = (type === 'income' ? 1 : -1) * newAmt;
      const netDelta = newSigned - oldSigned;
      if (netDelta !== 0) {
        accountStmts.push(c.env.DB.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(netDelta, account_id));
      }
    }
  } else {
    // 跨帳戶變更：針對銀行/現金帳戶回滾舊帳戶或認列新帳戶餘額
    if (oldAcc && (oldAcc.type === 'bank' || oldAcc.type === 'cash')) {
      const oldStmts = await getSyncAccountStatements(c.env.DB, existing.account_id as string, existing.type as string, oldAmt, true);
      accountStmts.push(...oldStmts);
    }
    if (newAcc.type === 'bank' || newAcc.type === 'cash') {
      const newStmts = await getSyncAccountStatements(c.env.DB, account_id, type, newAmt, false);
      accountStmts.push(...newStmts);
    }
  }

  const defer_to_next_statement = body.defer_to_next_statement !== undefined
    ? (Number(body.defer_to_next_statement) ? 1 : 0)
    : (existing.defer_to_next_statement || 0);

  // 若勾選延至下期 (defer_to_next_statement = 1)，立即重置 is_billed = 0
  const nextIsBilled = defer_to_next_statement === 1 ? 0 : (existing.is_billed || 0);

  const updateTxStmt = c.env.DB.prepare(
    'UPDATE transactions SET account_id = ?, type = ?, category = ?, amount = ?, note = ?, date = ?, is_shared = ?, defer_to_next_statement = ?, is_billed = ? WHERE id = ?'
  ).bind(account_id, type, category, amount, note, date, is_shared, defer_to_next_statement, nextIsBilled, id);

  await c.env.DB.batch([...accountStmts, updateTxStmt]);

  // 若舊帳戶或新帳戶為信用卡，自動執行狀態自癒與未出帳金額重算
  if (oldAcc && oldAcc.type === 'credit_card' && existing.account_id !== account_id) {
    await reconcileCreditCardUnbilled(c.env.DB, existing.account_id as string);
  }
  if (newAcc.type === 'credit_card') {
    await reconcileCreditCardUnbilled(c.env.DB, account_id);
  }

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
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT * FROM transactions WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first<any>();

  if (!existing) return c.json({ success: false, error: '收支紀錄不存在' }, 404);

  // Q5: 信用卡還款紀錄受保護
  const protectedCategories = ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'];
  if (protectedCategories.includes(existing.category as string)) {
    return c.json({
      success: false,
      error: `「${existing.category}」為系統內部平帳/轉帳紀錄，受系統保護禁止直接刪除。若金額有誤，請至「帳戶管理」進行資金校正。`,
    }, 400);
  }

  // 權限檢查：
  // 1. 個人私帳收支 (is_shared = 0)：嚴格僅限記錄者本人刪除
  if (existing.is_shared === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳收支僅限記錄者本人刪除' }, 403);
  }
  // 2. 家庭公帳收支 (is_shared = 1)：採「記錄者本人」或「家庭管理員」共治
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：他人記錄之家庭公帳收支僅限該記錄者或家庭管理員刪除' }, 403);
  }

  const acc = await c.env.DB.prepare('SELECT id, type, balance, unbilled FROM accounts WHERE id = ?')
    .bind(existing.account_id).first<{ id: string; type: string; balance: number; unbilled: number }>();

  const deleteTxStmt = c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id);

  if (acc && acc.type === 'credit_card') {
    await deleteTxStmt.run();
    await reconcileCreditCardUnbilled(c.env.DB, existing.account_id as string);
  } else {
    const revertStmts = await getSyncAccountStatements(c.env.DB, existing.account_id as string, existing.type as string, Number(existing.amount), true);
    await c.env.DB.batch([...revertStmts, deleteTxStmt]);
  }
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
    WHERE ${condition} AND t.type = 'expense' AND t.category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷') AND t.date LIKE ?
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
    WHERE ${condition}
      AND t.date LIKE ?
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
    WHERE t.user_id IN (${placeholders}) AND t.is_shared = 1 AND t.type = 'expense' AND t.category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷') AND t.date LIKE ?
    GROUP BY t.user_id, u.name
    ORDER BY total DESC
  `).bind(...memberUserIds, `${month}%`).all();

  return c.json({ success: true, data: rows.results });
});

export default transactions;
