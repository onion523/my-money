
let accountsMigrated = false;
async function ensureAccountsSchema(db: any) {
  if (accountsMigrated) return;
  try {
    await db.prepare('ALTER TABLE accounts ADD COLUMN is_joint INTEGER DEFAULT 0').run();
  } catch (_) {}
  accountsMigrated = true;
}
import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const accounts = new Hono<{ Bindings: Env; Variables: Vars }>();
accounts.use('*', authMiddleware);

// GET /accounts
accounts.get('/', async (c) => {
  await ensureAccountsSchema(c.env.DB);
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
  const results = await Promise.all((rows.results as any[]).map(async (acc) => {
    if (acc.type !== 'credit_card') return acc;
    const totalDue = (acc.balance || 0) + (acc.unbilled || 0);
    if (totalDue <= 0) {
      return { ...acc, shared_debt: 0, personal_debt: 0 };
    }
    const txs = await c.env.DB.prepare(
      "SELECT amount, is_shared FROM transactions WHERE account_id = ? AND type = 'expense' ORDER BY date DESC, created_at DESC LIMIT 50"
    ).bind(acc.id).all();
    let remaining = totalDue;
    let shared = 0;
    let personal = 0;
    for (const tx of (txs.results as Array<{ amount: number; is_shared: number }>)) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, tx.amount);
      if (tx.is_shared === 1) shared += take;
      else personal += take;
      remaining -= take;
    }
    if (remaining > 0) personal += remaining;
    return { ...acc, shared_debt: shared, personal_debt: personal };
  }));
  return c.json({ success: true, data: results });
});

// POST /accounts
accounts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { name, type, balance = 0, credit_limit, statement_day, payment_due_day, unbilled = 0, color = '#FF8A8A', is_joint = 0 } = body;
  await ensureAccountsSchema(c.env.DB);
  if (!name || !type) return c.json({ success: false, error: '請填寫帳戶名稱和類型' }, 400);
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO accounts (id, user_id, name, type, balance, credit_limit, statement_day, payment_due_day, unbilled, color, is_joint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, name, type, balance, credit_limit ?? null, statement_day ?? null, payment_due_day ?? null, unbilled, color, is_joint ? 1 : 0).run();
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
  const { name, balance, credit_limit, statement_day, payment_due_day, unbilled, color, is_joint } = body;
  await ensureAccountsSchema(c.env.DB);
  const existing = await c.env.DB.prepare(`SELECT id FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first();
  if (!existing) return c.json({ success: false, error: '帳戶不存在' }, 404);
  await c.env.DB.prepare(
    'UPDATE accounts SET name = ?, balance = ?, credit_limit = ?, statement_day = ?, payment_due_day = ?, unbilled = ?, color = ?, is_joint = ? WHERE id = ?'
  ).bind(name, balance, credit_limit ?? null, statement_day ?? null, payment_due_day ?? null, unbilled, color, is_joint !== undefined ? (Number(is_joint) ? 1 : 0) : 0, id).run();
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


// POST /accounts/pay-credit-card — 信用卡繳費沖銷
accounts.post('/pay-credit-card', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const body = await c.req.json();
  const { bank_account_id, credit_card_id, amount, date, note, is_shared } = body;

  const payAmount = Number(amount);
  if (!bank_account_id || !credit_card_id || isNaN(payAmount) || payAmount <= 0) {
    return c.json({ success: false, error: '請填寫扣款帳戶、信用卡及正確繳費金額' }, 400);
  }

  // 檢查銀行/扣款帳戶
  const bank = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(bank_account_id, ...memberUserIds).first<{ id: string; name: string; type: string; balance: number }>();

  if (!bank) return c.json({ success: false, error: '扣款帳戶不存在' }, 404);

  // 檢查信用卡帳戶
  const card = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders}) AND type = 'credit_card'`
  ).bind(credit_card_id, ...memberUserIds).first<{ id: string; name: string; type: string; balance: number; unbilled: number }>();

  if (!card) return c.json({ success: false, error: '信用卡不存在' }, 404);

  // Q6: 嚴格防呆上限檢查（不得超過已出帳+未出帳總額）
  const maxPayable = (card.balance || 0) + (card.unbilled || 0);
  if (payAmount > maxPayable && maxPayable > 0) {
    return c.json({ success: false, error: `繳款金額不可超過當前待繳總額 NT$ ${maxPayable.toLocaleString()}` }, 400);
  }

  // 1. 扣除銀行帳戶餘額
  const newBankBalance = bank.balance - payAmount;
  await c.env.DB.prepare('UPDATE accounts SET balance = ? WHERE id = ?')
    .bind(newBankBalance, bank_account_id).run();

  // 2. 沖銷信用卡欠款：優先沖銷已出帳 (balance)，剩餘沖銷未出帳 (unbilled)
  let newCardBalance = card.balance;
  let newCardUnbilled = card.unbilled;

  if (newCardBalance >= payAmount) {
    newCardBalance -= payAmount;
  } else {
    const remainder = payAmount - newCardBalance;
    newCardBalance = 0;
    newCardUnbilled = Math.max(0, newCardUnbilled - remainder);
  }

  await c.env.DB.prepare('UPDATE accounts SET balance = ?, unbilled = ? WHERE id = ?')
    .bind(newCardBalance, newCardUnbilled, credit_card_id).run();

  // 3. 建立交易紀錄（記錄銀行支出，分類為「信用卡還款」）
  const txId = generateId();
  const txDate = date || new Date().toISOString().slice(0, 10);
  const txNote = (note && note.trim()) ? note.trim() : `繳納【${card.name}】卡費`;

  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(txId, userId, bank_account_id, 'expense', '信用卡還款', payAmount, txNote, txDate, is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : 1).run();

  const txRow = await c.env.DB.prepare(`
    SELECT t.*, a.name as account_name, u.name as user_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).bind(txId).first();

  return c.json({
    success: true,
    data: {
      transaction: txRow,
      bank_balance: newBankBalance,
      card_balance: newCardBalance,
      card_unbilled: newCardUnbilled,
    }
  });
});


// POST /accounts/:id/rollover-statement — 結帳日一鍵結轉 (未出帳轉已出帳)
accounts.post('/:id/rollover-statement', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');
  const id = c.req.param('id');

  const card = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders}) AND type = 'credit_card'`
  ).bind(id, ...memberUserIds).first<{ id: string; name: string; balance: number; unbilled: number }>();

  if (!card) return c.json({ success: false, error: '信用卡不存在' }, 404);
  if ((card.unbilled || 0) <= 0) return c.json({ success: false, error: '目前無未出帳金額需結轉' }, 400);

  const newBalance = (card.balance || 0) + card.unbilled;
  await c.env.DB.prepare('UPDATE accounts SET balance = ?, unbilled = 0 WHERE id = ?')
    .bind(newBalance, id).run();

  return c.json({
    success: true,
    data: {
      id,
      balance: newBalance,
      unbilled: 0,
      message: `已將未出帳 NT$ ${card.unbilled.toLocaleString()} 成功結轉為已出帳待繳！`
    }
  });
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