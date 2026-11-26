import { Hono } from 'hono';
import { Env, RecurringItem } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';
import { getTaipeiDate } from '../utils/date';
import { ensureForecastSchema } from './forecast';

type Vars = { userId: string; userEmail: string; userName: string };
const recurring = new Hono<{ Bindings: Env; Variables: Vars }>();
recurring.use('*', authMiddleware);

export const CYCLE_MONTHS: Record<string, number> = {
  weekly: 0.25,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

let recurringMigrated = false;
let recurringMigratePromise: Promise<void> | null = null;
export async function ensureRecurringSchema(db: any) {
  if (recurringMigrated) return;
  if (!recurringMigratePromise) {
    recurringMigratePromise = (async () => {
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
      try {
        const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='recurring_items'").first();
        if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'weekly'")) {
          await db.prepare("PRAGMA foreign_keys = OFF").run();
          await db.prepare(`CREATE TABLE IF NOT EXISTS recurring_items_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            cycle TEXT NOT NULL CHECK(cycle IN ('weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual')),
            day_of_cycle INTEGER NOT NULL DEFAULT 1,
            month_of_cycle INTEGER NOT NULL DEFAULT 1,
            is_shared INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`).run();
          await db.prepare(`INSERT OR IGNORE INTO recurring_items_new (id, user_id, account_id, name, type, amount, cycle, day_of_cycle, month_of_cycle, is_shared, created_at)
            SELECT id, user_id, account_id, name, type, amount, cycle, COALESCE(day_of_cycle, 1), COALESCE(month_of_cycle, 1), COALESCE(is_shared, 0), created_at FROM recurring_items`).run();
          await db.prepare(`DROP TABLE recurring_items`).run();
          await db.prepare(`ALTER TABLE recurring_items_new RENAME TO recurring_items`).run();
          await db.prepare(`CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_items(user_id)`).run();
          await db.prepare("PRAGMA foreign_keys = ON").run();
        }
      } catch (err) {
        console.error('Migration recurring_items check constraint error:', err);
      }
      recurringMigrated = true;
    })().finally(() => {
      recurringMigratePromise = null;
    });
  }
  await recurringMigratePromise;
}

export interface EnrichedRecurringItem extends RecurringItem {
  monthly_share: number;
  is_settled_current_cycle: boolean;
  settled_source: 'transaction' | 'manual' | null;
  settled_amount_this_cycle: number;
  settled_monthly_share: number;
  remaining_monthly_share: number;
  accumulated_months: number;
  accumulated_sinking_fund: number;
  annual_total: number;
  annual_settled: number;
  annual_remaining: number;
}

export interface RecurringAmortizationSummary {
  monthly_expense: number;
  settled_monthly_expense: number;
  remaining_monthly_expense: number;
  monthly_income: number;
  settled_monthly_income: number;
  remaining_monthly_income: number;
  accumulated_sinking_fund: number;
  annual_total_expense: number;
  annual_settled_expense: number;
  annual_remaining_expense: number;
  items: EnrichedRecurringItem[];
}

/**
 * 計算長週期項目（cycleM >= 2）在當前月份所屬之「本期區間起訖月份」與「已累積攤提月數 k (1..cycleM)」
 */
function resolveLongCycleWindow(
  currYear: number,
  currMonth: number,
  cycleM: number,
  anchorM: number
): { startDate: string; endDate: string; startYm: string; endYm: string; accumulatedMonths: number; isDueThisMonth: boolean } {
  const diff = (((currMonth - anchorM) % cycleM) + cycleM) % cycleM;
  const isDueThisMonth = diff === 0;
  // 若本月即到期扣款月 (diff === 0)，表示已走滿 cycleM 個月 (含本月)；
  // 若尚未到下次到期扣款月 (diff > 0)，表示自上次到期月之後已走過 diff 個月 (1 .. cycleM - 1)
  const accumulatedMonths = isDueThisMonth ? cycleM : diff;

  // 本期對應之最近一次到期月（若本月即到期月則為本月，否則為往前推 diff 個月或本週期起算月）
  // 為了讓使用者在本期內提前繳納或於到期月繳納都能被偵測為「本期已繳」，區間涵蓋自上一次到期月次月（或若本月即到期月則往前 cycleM-1 個月）至本月底
  const windowMonthsBack = isDueThisMonth ? cycleM - 1 : diff - 1;
  let startYear = currYear;
  let startMonth = currMonth - windowMonthsBack;
  while (startMonth < 1) {
    startMonth += 12;
    startYear -= 1;
  }
  const startYm = `${startYear}-${String(startMonth).padStart(2, '0')}`;
  const endYm = `${currYear}-${String(currMonth).padStart(2, '0')}`;
  return {
    startDate: `${startYm}-01`,
    endDate: `${endYm}-31`,
    startYm,
    endYm,
    accumulatedMonths,
    isDueThisMonth,
  };
}

/**
 * 計算週期收支每月平均、雙軌自動已繳判定、當月尚需預留額與一年內週期準備金池 (ADR-0047)
 */
export async function computeRecurringAmortization(
  db: any,
  userId: string,
  memberUserIds: string[],
  scope = 'all'
): Promise<RecurringAmortizationSummary> {
  await Promise.all([
    ensureRecurringSchema(db),
    ensureForecastSchema(db),
  ]);

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

  const todayObj = getTaipeiDate();
  const currYear = todayObj.year;
  const currMonth = todayObj.month;
  const currentYm = `${currYear}-${String(currMonth).padStart(2, '0')}`;
  // 往前撈取 12 個月內之非系統收支明細，以供比對月繳、週繳與跨月長週期項目是否已發生
  const lookbackStartDate = `${currYear - 1}-${String(currMonth).padStart(2, '0')}-01`;
  const currentMonthEndDate = `${currentYm}-31`;
  const yearStartDate = `${currYear}-01-01`;

  let txScopeCond = `((user_id = ? AND is_shared = 0) OR (user_id IN (${placeholders}) AND is_shared = 1))`;
  let txScopeParams: any[] = [userId, ...memberUserIds];
  if (scope === 'household') {
    txScopeCond = `user_id IN (${placeholders}) AND is_shared = 1`;
    txScopeParams = [...memberUserIds];
  } else if (scope === 'personal') {
    txScopeCond = `user_id = ? AND is_shared = 0`;
    txScopeParams = [userId];
  }

  const [recRowsRes, txRowsRes, settledRowsRes] = await Promise.all([
    db.prepare(`
      SELECT r.*, a.name as account_name, a.is_joint as account_is_joint, u.name as user_name
      FROM recurring_items r
      LEFT JOIN accounts a ON r.account_id = a.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE ${sqlCondition}
      ORDER BY r.created_at ASC
    `).bind(...sqlParams).all(),
    db.prepare(`
      SELECT id, user_id, type, amount, note, date, is_shared
      FROM transactions
      WHERE ${txScopeCond}
        AND date >= ? AND date <= ?
        AND category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
        AND note IS NOT NULL AND TRIM(note) != ''
    `).bind(...txScopeParams, lookbackStartDate, currentMonthEndDate).all(),
    db.prepare(`
      SELECT event_key
      FROM forecast_settled_events
      WHERE user_id IN (${placeholders}) AND event_key LIKE 'recurring:%'
    `).bind(...memberUserIds).all(),
  ]);

  const rawItems = (recRowsRes.results || []) as RecurringItem[];
  const recentTxs = (txRowsRes.results || []) as Array<{
    id: string;
    user_id: string;
    type: 'income' | 'expense';
    amount: number;
    note: string;
    date: string;
    is_shared: number;
  }>;
  const settledKeys = ((settledRowsRes.results || []) as Array<{ event_key: string }>).map(r => r.event_key);

  const enrichedItems: EnrichedRecurringItem[] = rawItems.map(item => {
    const cycleM = CYCLE_MONTHS[item.cycle] || 1;
    const monthlyShare = item.amount / cycleM;
    const annualTotal = monthlyShare * 12;
    const itemNameLower = (item.name || '').trim().toLowerCase();
    const itemShared = Number(item.is_shared || 0);

    // 過濾與此週期項目同類型、同公私帳歸屬且備註包含項目名稱之實際收支明細
    const matchingTxs = itemNameLower
      ? recentTxs.filter(tx => {
          if (tx.type !== item.type) return false;
          if (Number(tx.is_shared || 0) !== itemShared) return false;
          if (itemShared === 0 && tx.user_id !== item.user_id) return false;
          const noteLower = (tx.note || '').trim().toLowerCase();
          return noteLower === itemNameLower || noteLower.includes(itemNameLower);
        })
      : [];

    // 過濾與此週期項目對應之手動已繳 event_key (格式: recurring:<id>:<YYYY-MM> 或 recurring:<id>:<YYYY-MM-DD>[:<chargeDate>])
    const itemSettledKeys = settledKeys.filter(k => k.startsWith(`recurring:${item.id}:`));

    let isSettledCurrentCycle = false;
    let settledSource: 'transaction' | 'manual' | null = null;
    let settledAmountThisCycle = 0;
    let settledMonthlyShare = 0;
    let accumulatedMonths = 1;
    let accumulatedSinkingFund = 0;

    if (item.cycle === 'weekly') {
      const monthStart = `${currentYm}-01`;
      const monthEnd = `${currentYm}-31`;
      const monthTxs = matchingTxs.filter(tx => tx.date >= monthStart && tx.date <= monthEnd);
      const hasFullMonthManual = itemSettledKeys.some(k => k === `recurring:${item.id}:${currentYm}`);
      const manualWeekKeys = itemSettledKeys.filter(k => {
        const suffix = k.slice(`recurring:${item.id}:`.length);
        // 若為信用卡平移 key recurring:<id>:<dueDate>:<chargeDate>，看原刷卡日或扣款日是否落於本月
        return suffix.startsWith(currentYm) || suffix.includes(`:${currentYm}`);
      });

      if (hasFullMonthManual) {
        isSettledCurrentCycle = true;
        settledSource = 'manual';
        settledAmountThisCycle = monthlyShare;
        settledMonthlyShare = monthlyShare;
      } else {
        const txSum = monthTxs.reduce((s, t) => s + Number(t.amount || 0), 0);
        const manualSum = manualWeekKeys.length * item.amount;
        const combinedSettled = Math.min(monthlyShare, Math.max(txSum, manualSum));
        if (combinedSettled > 0) {
          settledAmountThisCycle = combinedSettled;
          settledMonthlyShare = combinedSettled;
          isSettledCurrentCycle = combinedSettled >= monthlyShare;
          settledSource = txSum >= manualSum ? 'transaction' : 'manual';
        }
      }
    } else if (item.cycle === 'monthly') {
      const monthStart = `${currentYm}-01`;
      const monthEnd = `${currentYm}-31`;
      const monthTxs = matchingTxs.filter(tx => tx.date >= monthStart && tx.date <= monthEnd);
      const hasManual = itemSettledKeys.some(k => {
        const suffix = k.slice(`recurring:${item.id}:`.length);
        return suffix.startsWith(currentYm);
      });

      if (monthTxs.length > 0) {
        isSettledCurrentCycle = true;
        settledSource = 'transaction';
        settledAmountThisCycle = item.amount;
        settledMonthlyShare = monthlyShare;
      } else if (hasManual) {
        isSettledCurrentCycle = true;
        settledSource = 'manual';
        settledAmountThisCycle = item.amount;
        settledMonthlyShare = monthlyShare;
      }
    } else {
      // 長週期項目 (bimonthly, quarterly, semiannual, annual: cycleM >= 2)
      const anchorM = item.month_of_cycle || 1;
      const win = resolveLongCycleWindow(currYear, currMonth, cycleM, anchorM);
      accumulatedMonths = win.accumulatedMonths;

      const cycleTxs = matchingTxs.filter(tx => tx.date >= win.startDate && tx.date <= win.endDate);
      const hasManual = itemSettledKeys.some(k => {
        const suffix = k.slice(`recurring:${item.id}:`.length);
        const ym = suffix.slice(0, 7);
        return ym >= win.startYm && ym <= win.endYm;
      });

      if (cycleTxs.length > 0) {
        isSettledCurrentCycle = true;
        settledSource = 'transaction';
        settledAmountThisCycle = item.amount;
        settledMonthlyShare = monthlyShare;
        accumulatedSinkingFund = 0;
      } else if (hasManual) {
        isSettledCurrentCycle = true;
        settledSource = 'manual';
        settledAmountThisCycle = item.amount;
        settledMonthlyShare = monthlyShare;
        accumulatedSinkingFund = 0;
      } else {
        // 本期尚未繳納：截至本月帳戶應已累積留存之長週期準備金 = accumulatedMonths * monthlyShare
        if (item.type === 'expense') {
          accumulatedSinkingFund = accumulatedMonths * monthlyShare;
        }
      }
    }

    const remainingMonthlyShare = Math.max(0, monthlyShare - settledMonthlyShare);

    // 計算當年度 (YYYY-01-01 ~ 本月底) 已繳納總額 (上限為 annualTotal)
    const yearTxsSum = matchingTxs
      .filter(tx => tx.date >= yearStartDate && tx.date <= currentMonthEndDate)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const annualSettled = Math.min(annualTotal, Math.max(yearTxsSum, settledAmountThisCycle));
    const annualRemaining = Math.max(0, annualTotal - annualSettled);

    return {
      ...item,
      monthly_share: Math.round(monthlyShare * 100) / 100,
      is_settled_current_cycle: isSettledCurrentCycle,
      settled_source: settledSource,
      settled_amount_this_cycle: Math.round(settledAmountThisCycle * 100) / 100,
      settled_monthly_share: Math.round(settledMonthlyShare * 100) / 100,
      remaining_monthly_share: Math.round(remainingMonthlyShare * 100) / 100,
      accumulated_months: accumulatedMonths,
      accumulated_sinking_fund: Math.round(accumulatedSinkingFund * 100) / 100,
      annual_total: Math.round(annualTotal * 100) / 100,
      annual_settled: Math.round(annualSettled * 100) / 100,
      annual_remaining: Math.round(annualRemaining * 100) / 100,
    };
  });

  const expItems = enrichedItems.filter(i => i.type === 'expense');
  const incItems = enrichedItems.filter(i => i.type === 'income');

  const monthlyExpense = expItems.reduce((s, i) => s + i.monthly_share, 0);
  const settledMonthlyExpense = expItems.reduce((s, i) => s + i.settled_monthly_share, 0);
  const remainingMonthlyExpense = Math.max(0, monthlyExpense - settledMonthlyExpense);

  const monthlyIncome = incItems.reduce((s, i) => s + i.monthly_share, 0);
  const settledMonthlyIncome = incItems.reduce((s, i) => s + i.settled_monthly_share, 0);
  const remainingMonthlyIncome = Math.max(0, monthlyIncome - settledMonthlyIncome);

  const accumulatedSinkingFund = expItems.reduce((s, i) => s + i.accumulated_sinking_fund, 0);
  const annualTotalExpense = expItems.reduce((s, i) => s + i.annual_total, 0);
  const annualSettledExpense = expItems.reduce((s, i) => s + i.annual_settled, 0);
  const annualRemainingExpense = Math.max(0, annualTotalExpense - annualSettledExpense);

  return {
    monthly_expense: Math.round(monthlyExpense * 100) / 100,
    settled_monthly_expense: Math.round(settledMonthlyExpense * 100) / 100,
    remaining_monthly_expense: Math.round(remainingMonthlyExpense * 100) / 100,
    monthly_income: Math.round(monthlyIncome * 100) / 100,
    settled_monthly_income: Math.round(settledMonthlyIncome * 100) / 100,
    remaining_monthly_income: Math.round(remainingMonthlyIncome * 100) / 100,
    accumulated_sinking_fund: Math.round(accumulatedSinkingFund * 100) / 100,
    annual_total_expense: Math.round(annualTotalExpense * 100) / 100,
    annual_settled_expense: Math.round(annualSettledExpense * 100) / 100,
    annual_remaining_expense: Math.round(annualRemainingExpense * 100) / 100,
    items: enrichedItems,
  };
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
  const rawDay = Number(day_of_cycle) || 1;
  const normalizedDay = cycle === 'weekly' ? (rawDay >= 1 && rawDay <= 7 ? rawDay : 1) : Math.min(31, Math.max(1, rawDay));
  const normalizedMonth = cycle === 'weekly' || cycle === 'monthly' ? 1 : (Number(month_of_cycle) || 1);
  await c.env.DB.prepare(
    'INSERT INTO recurring_items (id, user_id, account_id, name, type, amount, cycle, day_of_cycle, month_of_cycle, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, account_id ?? null, name, type, amount, cycle, normalizedDay, normalizedMonth, sharedFlag).run();

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
  if (existing.is_shared === 0 && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳週期項目僅限建立者本人修改' }, 403);
  }
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：他人建立之家庭公帳週期項目僅限該建立者或家庭管理員修改' }, 403);
  }

  const { name, type, amount, cycle, day_of_cycle, month_of_cycle = 1, account_id, is_shared } = await c.req.json();
  const sharedFlag = is_shared !== undefined ? (Number(is_shared) ? 1 : 0) : existing.is_shared;
  const rawDay = Number(day_of_cycle) || 1;
  const normalizedDay = cycle === 'weekly' ? (rawDay >= 1 && rawDay <= 7 ? rawDay : 1) : Math.min(31, Math.max(1, rawDay));
  const normalizedMonth = cycle === 'weekly' || cycle === 'monthly' ? 1 : (Number(month_of_cycle) || 1);

  await c.env.DB.prepare('UPDATE recurring_items SET name=?, type=?, amount=?, cycle=?, day_of_cycle=?, month_of_cycle=?, account_id=?, is_shared=? WHERE id=?')
    .bind(name, type, amount, cycle, normalizedDay, normalizedMonth, account_id ?? null, sharedFlag, id).run();

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

// POST /recurring/:id/settle — 週期收支卡片一鍵標記／取消本期已繳 (與 forecast_settled_events 雙向互通，ADR-0047)
recurring.post('/:id/settle', async (c) => {
  const userId = c.get('userId');
  await Promise.all([
    ensureRecurringSchema(c.env.DB),
    ensureForecastSchema(c.env.DB),
  ]);
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const settled = Boolean(body.settled);
  const todayObj = getTaipeiDate();
  const targetYm: string = body.month || `${todayObj.year}-${String(todayObj.month).padStart(2, '0')}`;

  const { memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  const existing = await c.env.DB.prepare(
    `SELECT * FROM recurring_items WHERE id = ? AND user_id IN (${placeholders})`
  ).bind(id, ...memberUserIds).first<any>();

  if (!existing) return c.json({ success: false, error: '找不到對應的週期收支項目' }, 404);

  if ((existing.is_shared === 0 || !existing.is_shared) && existing.user_id !== userId) {
    return c.json({ success: false, error: '權限不足：個人私帳週期項目僅限建立者本人標記已繳' }, 403);
  }
  if (existing.is_shared === 1 && existing.user_id !== userId && myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：家庭公帳週期項目僅限建立者本人或家庭管理員標記已繳' }, 403);
  }

  const monthKey = `recurring:${id}:${targetYm}`;
  if (settled) {
    // 同時寫入月份級別 key 與當月目標扣款日 key（讓預測頁時間軸上的當月事件也同步勾選）
    const [y, m] = targetYm.split('-').map(Number);
    const maxDays = new Date(y, m, 0).getDate();
    const targetDay = Math.min(Number(existing.day_of_cycle) || 1, maxDays);
    const dateKey = `recurring:${id}:${targetYm}-${String(targetDay).padStart(2, '0')}`;
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT OR REPLACE INTO forecast_settled_events (event_key, user_id) VALUES (?, ?)').bind(monthKey, userId),
      ...(existing.cycle !== 'weekly'
        ? [c.env.DB.prepare('INSERT OR REPLACE INTO forecast_settled_events (event_key, user_id) VALUES (?, ?)').bind(dateKey, userId)]
        : []),
    ]);
  } else {
    // 移除該項目在該月份（或當前長週期區間內）的所有手動已繳紀錄
    const cycleM = CYCLE_MONTHS[existing.cycle] || 1;
    if (cycleM >= 2) {
      const [y, m] = targetYm.split('-').map(Number);
      const win = resolveLongCycleWindow(y, m, cycleM, Number(existing.month_of_cycle) || 1);
      await c.env.DB.prepare(
        `DELETE FROM forecast_settled_events WHERE event_key LIKE ? AND substr(event_key, ?, 7) >= ? AND substr(event_key, ?, 7) <= ?`
      ).bind(`recurring:${id}:%`, `recurring:${id}:`.length + 1, win.startYm, `recurring:${id}:`.length + 1, win.endYm).run();
    } else {
      await c.env.DB.prepare(
        `DELETE FROM forecast_settled_events WHERE event_key LIKE ?`
      ).bind(`recurring:${id}:${targetYm}%`).run();
    }
  }

  return c.json({ success: true, data: { id, month: targetYm, is_settled: settled } });
});

// GET /recurring/amortize — 固定支出月攤提合計、已繳扣除與一年內週期準備金池 (支援 scope = all | household | personal，ADR-0047)
recurring.get('/amortize', async (c) => {
  const userId = c.get('userId');
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);

  const summary = await computeRecurringAmortization(c.env.DB, userId, memberUserIds, scope);
  return c.json({ success: true, data: summary });
});

export default recurring;
