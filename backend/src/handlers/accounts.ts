import { getTaipeiDateString } from '../utils/date';

let accountsMigrated = false;
async function ensureAccountsSchema(db: any) {
  if (accountsMigrated) return;
  try {
    await db.prepare('ALTER TABLE accounts ADD COLUMN is_joint INTEGER DEFAULT 0').run();
  } catch (_) {}
  try {
    await db.prepare('ALTER TABLE accounts ADD COLUMN last_rollover_at DATETIME').run();
  } catch (_) {}
  try {
    await db.prepare('ALTER TABLE transactions ADD COLUMN unbilled_offset REAL DEFAULT 0').run();
  } catch (_) {}
  try {
    const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'").first();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'cash'")) {
      await db.prepare("PRAGMA foreign_keys = OFF").run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS accounts_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('bank', 'credit_card', 'cash')),
        balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL,
        statement_day INTEGER,
        payment_due_day INTEGER,
        unbilled REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#FF8A8A',
        is_joint INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
      await db.prepare(`INSERT OR IGNORE INTO accounts_new (id, user_id, name, type, balance, credit_limit, statement_day, payment_due_day, unbilled, color, is_joint, created_at)
        SELECT id, user_id, name, type, balance, credit_limit, statement_day, payment_due_day, unbilled, color, COALESCE(is_joint, 0), created_at FROM accounts`).run();
      await db.prepare(`DROP TABLE accounts`).run();
      await db.prepare(`ALTER TABLE accounts_new RENAME TO accounts`).run();
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)`).run();
      await db.prepare("PRAGMA foreign_keys = ON").run();
    }
  } catch (err) {
    console.error('Migration accounts check constraint error:', err);
  }
  accountsMigrated = true;
}
import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';
import { ensureRecurringSchema } from './recurring';

type Vars = { userId: string; userEmail: string; userName: string };
const accounts = new Hono<{ Bindings: Env; Variables: Vars }>();
accounts.use('*', authMiddleware);

// GET /accounts
accounts.get('/', async (c) => {
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');
  const scope = c.req.query('scope') || 'all';

  let sqlCondition = `(a.user_id = ? OR (a.user_id IN (${placeholders}) AND a.is_joint = 1))`;
  let sqlParams: (string | number)[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    // 納入共同帳戶 (is_joint = 1)，以及家庭成員名下有待繳欠款的個人信用卡（後續過濾 shared_debt > 0）
    sqlCondition = `a.user_id IN (${placeholders}) AND (a.is_joint = 1 OR a.type = 'credit_card')`;
    sqlParams = [...memberUserIds];
  } else if (scope === 'personal') {
    sqlCondition = `a.user_id = ? AND a.is_joint = 0`;
    sqlParams = [userId];
  }

  const rows = await c.env.DB.prepare(`
    SELECT a.*, u.name as owner_name
    FROM accounts a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE ${sqlCondition}
    ORDER BY a.created_at ASC
  `).bind(...sqlParams).all();
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

  // 過濾與脫敏處理 (ADR 0015)：
  // 在公帳視角下，若為個人私卡 (is_joint = 0)，必須滿足 shared_debt > 0 才納入展示；
  // 若為他人私卡，執行隱私脫敏（僅揭示公帳待繳額，遮蔽個人額度與個人私密消費）。
  const finalResults = results
    .filter(acc => {
      if (scope === 'household' && acc.is_joint === 0) {
        return acc.type === 'credit_card' && (acc.shared_debt || 0) > 0;
      }
      return true;
    })
    .map(acc => {
      if (acc.is_joint === 0 && acc.user_id !== userId) {
        return {
          ...acc,
          credit_limit: null,
          balance: 0,
          unbilled: acc.shared_debt || 0,
          personal_debt: 0,
          is_masked: true,
        };
      }
      return acc;
    });

  return c.json({ success: true, data: finalResults });
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
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, balance, credit_limit, statement_day, payment_due_day, unbilled, color, is_joint } = body;
  await ensureAccountsSchema(c.env.DB);
  const existing = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first<any>();
  if (!existing) return c.json({ success: false, error: '帳戶不存在' }, 404);

  // 權限檢查：個人私帳嚴禁他人修改；共同帳戶僅建立者或管理員可修改
  if (existing.is_joint === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳僅限帳戶擁有者本人修改' }, 403);
  }
  if (existing.is_joint === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：家庭共同帳戶僅限建立者或家庭管理員修改' }, 403);
  }

  await c.env.DB.prepare(
    'UPDATE accounts SET name = ?, balance = ?, credit_limit = ?, statement_day = ?, payment_due_day = ?, unbilled = ?, color = ?, is_joint = ? WHERE id = ?'
  ).bind(
    name ?? existing.name,
    balance !== undefined ? balance : existing.balance,
    credit_limit !== undefined ? (credit_limit ?? null) : existing.credit_limit,
    statement_day !== undefined ? (statement_day ?? null) : existing.statement_day,
    payment_due_day !== undefined ? (payment_due_day ?? null) : existing.payment_due_day,
    unbilled !== undefined ? unbilled : existing.unbilled,
    color ?? existing.color,
    is_joint !== undefined ? (Number(is_joint) ? 1 : 0) : existing.is_joint,
    id
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

// DELETE /accounts/:id
accounts.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare(`SELECT id, user_id, is_joint FROM accounts WHERE id = ? AND user_id IN (${placeholders})`).bind(id, ...memberUserIds).first<any>();
  if (!existing) return c.json({ success: false, error: '帳戶不存在' }, 404);

  // 權限檢查：個人私帳嚴禁他人刪除；共同帳戶僅建立者或管理員可刪除
  if (existing.is_joint === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳僅限帳戶擁有者本人刪除' }, 403);
  }
  if (existing.is_joint === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：家庭共同帳戶僅限建立者或家庭管理員刪除' }, 403);
  }

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
  ).bind(credit_card_id, ...memberUserIds).first<{ id: string; name: string; type: string; balance: number; unbilled: number; is_joint: number; user_id: string }>();

  if (!card) return c.json({ success: false, error: '信用卡不存在' }, 404);

  // 權限檢查 (ADR 0013 & ADR 0015)：
  // 他人個人私卡僅允許繳納家庭代墊公帳 (is_shared === 1)；若嘗試為他人私卡操作個人私帳還款 (is_shared === 0)，強制攔截
  const isSharedFlag = is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : 1;
  if ((card.is_joint === 0 || card.is_joint === null) && card.user_id !== userId) {
    if (isSharedFlag !== 1) {
      return c.json({ success: false, error: '權限不足：個人信用卡還款沖銷僅限持卡人本人操作' }, 403);
    }
  }

  // Q6: 嚴格防呆上限檢查（不得超過已出帳+未出帳總額）
  const maxPayable = (card.balance || 0) + (card.unbilled || 0);
  if (payAmount > maxPayable && maxPayable > 0) {
    return c.json({ success: false, error: `繳款金額不可超過當前待繳總額 NT$ ${maxPayable.toLocaleString()}` }, 400);
  }

  // 1. 扣除銀行帳戶餘額
  const newBankBalance = bank.balance - payAmount;
  await c.env.DB.prepare('UPDATE accounts SET balance = ? WHERE id = ?')
    .bind(newBankBalance, bank_account_id).run();

  // 2. 沖銷信用卡欠款：優先沖銷已出帳 (balance)，剩餘沖銷未出帳 (unbilled) 並記錄沖減未出帳額
  let newCardBalance = card.balance;
  let newCardUnbilled = card.unbilled;
  let unbilledOffset = 0;

  if (newCardBalance >= payAmount) {
    newCardBalance -= payAmount;
  } else {
    const remainder = payAmount - newCardBalance;
    newCardBalance = 0;
    unbilledOffset = Math.min(newCardUnbilled, remainder);
    newCardUnbilled = Math.max(0, newCardUnbilled - remainder);
  }

  await c.env.DB.prepare('UPDATE accounts SET balance = ?, unbilled = ? WHERE id = ?')
    .bind(newCardBalance, newCardUnbilled, credit_card_id).run();

  // 3. 建立交易紀錄（記錄銀行支出，分類為「信用卡還款」）
  const txId = generateId();
  const txDate = date || getTaipeiDateString();
  const txNote = (note && note.trim()) ? note.trim() : `繳納【${card.name}】卡費`;

  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(txId, userId, bank_account_id, 'expense', '信用卡還款', payAmount, txNote, txDate, is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : 1).run();

  // 信用卡端同步建立還款流水 (雙向沖帳紀錄，記錄 unbilled_offset 供校準抵扣)
  const cardTxId = generateId();
  const cardTxNote = `扣款還款 (來自【${bank.name}】)`;
  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared, unbilled_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(cardTxId, userId, credit_card_id, 'income', '信用卡還款', payAmount, cardTxNote, txDate, is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : 1, unbilledOffset).run();

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


// POST /accounts/:id/rollover-statement — 結帳日一鍵出帳作業 (未出帳轉已出帳)
accounts.post('/:id/rollover-statement', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');
  const id = c.req.param('id');

  const card = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders}) AND type = 'credit_card'`
  ).bind(id, ...memberUserIds).first<{ id: string; name: string; balance: number; unbilled: number; is_joint: number; user_id: string }>();

  if (!card) return c.json({ success: false, error: '信用卡不存在' }, 404);

  // 權限檢查：個人信用卡出帳作業僅限持卡人本人操作
  if ((card.is_joint === 0 || card.is_joint === null) && card.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人信用卡出帳作業僅限持卡人本人操作' }, 403);
  }
  if ((card.unbilled || 0) <= 0) return c.json({ success: false, error: '目前無未出帳金額需出帳' }, 400);

  const newBalance = (card.balance || 0) + card.unbilled;
  await c.env.DB.prepare('UPDATE accounts SET balance = ?, unbilled = 0, last_rollover_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(newBalance, id).run();

  return c.json({
    success: true,
    data: {
      id,
      balance: newBalance,
      unbilled: 0,
      message: `帳單出帳作業完成！已轉入已出帳待繳款。`
    }
  });
});

// POST /accounts/:id/reconcile — 信用卡未出帳自動校準
accounts.post('/:id/reconcile', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');
  const id = c.req.param('id');

  const card = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders}) AND type = 'credit_card'`
  ).bind(id, ...memberUserIds).first<{ id: string; name: string; balance: number; unbilled: number; statement_day: number | null; is_joint: number; user_id: string }>();

  if (!card) return c.json({ success: false, error: '信用卡不存在或無權限' }, 404);

  // 權限檢查：個人信用卡校準僅限持卡人本人操作
  if ((card.is_joint === 0 || card.is_joint === null) && card.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人信用卡校準僅限持卡人本人操作' }, 403);
  }

  // 計算當期結帳週期起點 (優先依據最後出帳作業時間點)
  let timeCondition = '';
  let sqlParams: (string | number)[] = [id];

  const cardWithRollover = await c.env.DB.prepare('SELECT last_rollover_at FROM accounts WHERE id = ?').bind(id).first<{ last_rollover_at: string | null }>();

  if (cardWithRollover && cardWithRollover.last_rollover_at) {
    timeCondition = ' AND created_at > ?';
    sqlParams.push(cardWithRollover.last_rollover_at);
  } else if (card.statement_day && card.statement_day >= 1 && card.statement_day <= 31) {
    const taipeiDateStr = getTaipeiDateString();
    const [currYear, currMonth, currDay] = taipeiDateStr.split('-').map(Number);
    let statementYear = currYear;
    let statementMonth = currMonth;

    if (currDay <= card.statement_day) {
      statementMonth -= 1;
      if (statementMonth === 0) {
        statementMonth = 12;
        statementYear -= 1;
      }
    }
    const lastDayOfMonth = new Date(statementYear, statementMonth, 0).getDate();
    const day = Math.min(card.statement_day, lastDayOfMonth);
    const statementDate = `${statementYear}-${String(statementMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    timeCondition = ' AND date > ?';
    sqlParams.push(statementDate);
  }

  // 1. 當期消費支出總額
  const expenseRow = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE account_id = ? AND type = 'expense'
      AND category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
      ${timeCondition}
  `).bind(...sqlParams).first<{ total: number }>();

  // 2. 當期刷退收入總額 (卡片收入退貨)
  const refundRow = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE account_id = ? AND type = 'income'
      AND category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
      ${timeCondition}
  `).bind(...sqlParams).first<{ total: number }>();

  // 3. 當期還款沖抵未出帳總額 (category = '信用卡還款'，僅加總 unbilled_offset，避免誤扣沖銷已出帳之款項)
  const repaymentRow = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(unbilled_offset), 0) as total
    FROM transactions
    WHERE account_id = ? AND category = '信用卡還款'
      ${timeCondition}
  `).bind(...sqlParams).first<{ total: number }>();

  const totalExp = expenseRow ? Number(expenseRow.total) : 0;
  const totalRef = refundRow ? Number(refundRow.total) : 0;
  const totalUnbilledOffset = repaymentRow ? Number(repaymentRow.total) : 0;

  // 未出帳 = MAX(0, 支出 - 刷退 - 當期已沖未出帳還款)
  const newUnbilled = Math.max(0, totalExp - totalRef - totalUnbilledOffset);

  // 更新 accounts.unbilled
  await c.env.DB.prepare('UPDATE accounts SET unbilled = ? WHERE id = ?')
    .bind(newUnbilled, id).run();

  // 重算 shared_debt 與 personal_debt
  const totalDue = (card.balance || 0) + newUnbilled;
  let shared = 0;
  let personal = 0;
  if (totalDue > 0) {
    const txs = await c.env.DB.prepare(
      "SELECT amount, is_shared FROM transactions WHERE account_id = ? AND type = 'expense' ORDER BY date DESC, created_at DESC LIMIT 50"
    ).bind(card.id).all();
    let remaining = totalDue;
    for (const tx of (txs.results as Array<{ amount: number; is_shared: number }>)) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, tx.amount);
      if (tx.is_shared === 1) shared += take;
      else personal += take;
      remaining -= take;
    }
    if (remaining > 0) personal += remaining;
  }

  return c.json({
    success: true,
    data: {
      id,
      name: card.name,
      balance: card.balance,
      unbilled: newUnbilled,
      shared_debt: shared,
      personal_debt: personal,
      message: `已自動校準「${card.name}」未出帳金額為 NT$ ${newUnbilled.toLocaleString()}`,
    }
  });
});


// GET /accounts/balance 淨可用資金
accounts.get('/balance', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');
  const scope = c.req.query('scope') || 'all';

  let sqlCondition = `(user_id = ? OR (user_id IN (${placeholders}) AND is_joint = 1))`;
  let sqlParams: (string | number)[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    sqlCondition = `user_id IN (${placeholders}) AND is_joint = 1`;
    sqlParams = [...memberUserIds];
  } else if (scope === 'personal') {
    sqlCondition = `user_id = ? AND is_joint = 0`;
    sqlParams = [userId];
  }

  const allAccounts = await c.env.DB.prepare(`SELECT * FROM accounts WHERE ${sqlCondition}`).bind(...sqlParams).all();
  const accs = allAccounts.results as Array<{ type: string; balance: number; unbilled: number }>;
  const cashTotal = accs.filter(a => a.type === 'cash').reduce((s, a) => s + (a.balance || 0), 0);
  const bankTotal = accs.filter(a => a.type === 'bank').reduce((s, a) => s + (a.balance || 0), 0);
  const ccBilled = accs.filter(a => a.type === 'credit_card').reduce((s, a) => s + (a.balance || 0), 0);
  let ccUnbilled = accs.filter(a => a.type === 'credit_card').reduce((s, a) => s + (a.unbilled || 0), 0);

  // ADR 0015 精準會計責任法：在公帳視角下，加總全體成員個人私卡上的家庭代墊公帳欠款 (shared_debt)
  if (scope === 'household') {
    const personalCards = await c.env.DB.prepare(
      `SELECT id, balance, unbilled FROM accounts WHERE user_id IN (${placeholders}) AND is_joint = 0 AND type = 'credit_card'`
    ).bind(...memberUserIds).all<{ id: string; balance: number; unbilled: number }>();

    for (const card of personalCards.results) {
      const totalDue = (card.balance || 0) + (card.unbilled || 0);
      if (totalDue <= 0) continue;
      const txs = await c.env.DB.prepare(
        "SELECT amount, is_shared FROM transactions WHERE account_id = ? AND type = 'expense' ORDER BY date DESC, created_at DESC LIMIT 50"
      ).bind(card.id).all<{ amount: number; is_shared: number }>();
      let remaining = totalDue;
      let cardShared = 0;
      for (const tx of txs.results) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, tx.amount);
        if (tx.is_shared === 1) cardShared += take;
        remaining -= take;
      }
      ccUnbilled += cardShared;
    }
  }

  const available = cashTotal + bankTotal - ccBilled - ccUnbilled;

  await ensureRecurringSchema(c.env.DB);
  let recCondition = `((r.user_id = ? AND r.is_shared = 0) OR (r.user_id IN (${placeholders}) AND r.is_shared = 1))`;
  let recParams: any[] = [userId, ...memberUserIds];
  if (scope === 'household') {
    recCondition = `r.user_id IN (${placeholders}) AND r.is_shared = 1`;
    recParams = [...memberUserIds];
  } else if (scope === 'personal') {
    recCondition = `r.user_id = ? AND r.is_shared = 0`;
    recParams = [userId];
  }

  const recurring = await c.env.DB.prepare(
    `SELECT amount, cycle FROM recurring_items r WHERE ${recCondition} AND type = 'expense'`
  ).bind(...recParams).all();
  const cycleMonths: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };
  const monthlyFixed = (recurring.results as Array<{ amount: number; cycle: string }>)
    .reduce((s, r) => s + r.amount / (cycleMonths[r.cycle] || 1), 0);

  let monthlyGoals = 0;
  if (scope !== 'household') {
    const goalsCondition = scope === 'personal' ? 'user_id = ?' : `user_id IN (${placeholders})`;
    const goalsParams = scope === 'personal' ? [userId] : memberUserIds;
    const goals = await c.env.DB.prepare(`SELECT monthly_reserve FROM goals WHERE ${goalsCondition}`).bind(...goalsParams).all();
    monthlyGoals = (goals.results as Array<{ monthly_reserve: number }>).reduce((s, g) => s + g.monthly_reserve, 0);
  }

  const disposable = available - monthlyFixed - monthlyGoals;
  return c.json({ success: true, data: { cashTotal, bankTotal, ccBilled, ccUnbilled, available, monthlyFixed, monthlyGoals, disposable } });
});


// POST /accounts/transfer (ATM提款 / 帳戶互轉)
accounts.post('/transfer', async (c) => {
  const userId = c.get('userId');
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const body = await c.req.json();
  const { from_account_id, to_account_id, amount, date = getTaipeiDateString(), note = '' } = body;

  const amt = Number(amount);
  if (!from_account_id || !to_account_id || isNaN(amt) || amt <= 0) {
    return c.json({ success: false, error: '請填寫正確的轉出帳戶、轉入帳戶及大於 0 的金額' }, 400);
  }
  if (from_account_id === to_account_id) {
    return c.json({ success: false, error: '轉出與轉入帳戶不能相同' }, 400);
  }

  const fromAcc = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND (user_id = ? OR (user_id IN (${placeholders}) AND is_joint = 1))`
  ).bind(from_account_id, userId, ...memberUserIds).first<any>();

  if (!fromAcc) {
    return c.json({ success: false, error: '找不到轉出帳戶或無權限操作' }, 404);
  }

  const toAcc = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND (user_id = ? OR (user_id IN (${placeholders}) AND is_joint = 1))`
  ).bind(to_account_id, userId, ...memberUserIds).first<any>();

  if (!toAcc) {
    return c.json({ success: false, error: '找不到轉入帳戶或無權限操作' }, 404);
  }

  if (fromAcc.balance < amt && fromAcc.type !== 'credit_card') {
    return c.json({ success: false, error: `轉出帳戶餘額不足（目前餘額：NT$ ${fromAcc.balance.toLocaleString()}）` }, 400);
  }

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(amt, from_account_id),
    c.env.DB.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(amt, to_account_id),
  ]);

  const isAtm = fromAcc.type === 'bank' && toAcc.type === 'cash';
  const category = isAtm ? 'ATM提款' : '內部轉帳';
  const outTxId = generateId();
  const inTxId = generateId();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(outTxId, userId, from_account_id, 'expense', category, amt, note ? `${note} (轉至 ${toAcc.name})` : `轉至 ${toAcc.name}`, date, fromAcc.is_joint ? 1 : 0),
    c.env.DB.prepare(
      'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(inTxId, userId, to_account_id, 'income', category, amt, note ? `${note} (來自 ${fromAcc.name})` : `來自 ${fromAcc.name}`, date, toAcc.is_joint ? 1 : 0)
  ]);

  return c.json({
    success: true,
    data: {
      message: `${isAtm ? 'ATM 提款' : '內部轉帳'}成功 NT$ ${amt.toLocaleString()} (${fromAcc.name} ➡️ ${toAcc.name})`,
      from_balance: fromAcc.balance - amt,
      to_balance: toAcc.balance + amt
    }
  });
});

export default accounts;