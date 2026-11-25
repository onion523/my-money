import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';
import { getTaipeiDateString } from '../utils/date';

type Vars = { userId: string; userEmail: string; userName: string };
const budgets = new Hono<{ Bindings: Env; Variables: Vars }>();
budgets.use('*', authMiddleware);

export const SYSTEM_CATEGORIES = ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'] as const;
export const TOTAL_BUDGET_CATEGORY = '__TOTAL__';

let budgetsMigrated = false;
let budgetsMigratePromise: Promise<void> | null = null;
export async function ensureBudgetsSchema(db: any) {
  if (budgetsMigrated) return;
  if (!budgetsMigratePromise) {
    budgetsMigratePromise = (async () => {
      try {
        const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'").first();
        if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('is_shared')) {
          await db.prepare('PRAGMA foreign_keys = OFF').run();
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS budgets_new (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              category TEXT NOT NULL,
              amount REAL NOT NULL,
              month TEXT NOT NULL DEFAULT 'default',
              is_shared INTEGER NOT NULL DEFAULT 0,
              UNIQUE(user_id, is_shared, category, month)
            )
          `).run();
          await db.prepare(`
            INSERT OR IGNORE INTO budgets_new (id, user_id, category, amount, month, is_shared)
            SELECT id, user_id, category, amount, month, 0 FROM budgets
          `).run();
          // 為既有歷史單月預算自動建立一份常駐預設 ('default')，確保跨月無縫沿用
          await db.prepare(`
            INSERT OR IGNORE INTO budgets_new (id, user_id, category, amount, month, is_shared)
            SELECT id || '_def', user_id, category, amount, 'default', 0
            FROM budgets b1
            WHERE b1.month != 'default'
              AND NOT EXISTS (
                SELECT 1 FROM budgets b2
                WHERE b2.user_id = b1.user_id AND b2.category = b1.category AND b2.month = 'default'
              )
              AND b1.month = (
                SELECT MAX(b3.month) FROM budgets b3
                WHERE b3.user_id = b1.user_id AND b3.category = b1.category
              )
          `).run();
          await db.prepare('DROP TABLE budgets').run();
          await db.prepare('ALTER TABLE budgets_new RENAME TO budgets').run();
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month)').run();
          await db.prepare('PRAGMA foreign_keys = ON').run();
        }
      } catch (err) {
        console.error('Migration budgets schema error:', err);
      }
      budgetsMigrated = true;
    })().finally(() => {
      budgetsMigratePromise = null;
    });
  }
  await budgetsMigratePromise;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  is_shared: number;
}

export interface ScopedBudgetItem {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  is_shared: number;
  is_persistent: boolean;
  personal_amount: number;
  shared_amount: number;
  spent: number;
  over: boolean;
}

export interface ScopedBudgetSummary {
  month: string;
  scope: string;
  manual_total_budget: number;
  personal_manual_total_budget: number;
  shared_manual_total_budget: number;
  category_budget_sum: number;
  effective_total_budget: number;
  total_spent: number;
  remaining_budget: number;
  over_budget: boolean;
  items: ScopedBudgetItem[];
}

/**
 * 解析特定月份在指定層級（私帳 is_shared=0 或 公帳 is_shared=1）之各分類有效預算
 * 規則：若該分類存在 month = targetMonth 之覆寫則優先取用，否則回退取用 month = 'default' 常駐預設
 */
export function resolveLayerBudgets(
  rows: BudgetRow[],
  targetMonth: string,
  isShared: 0 | 1,
  userId?: string
): Map<string, BudgetRow> {
  const layerRows = rows.filter(r => {
    if (Number(r.is_shared || 0) !== isShared) return false;
    if (isShared === 0 && userId && r.user_id !== userId) return false;
    return r.month === targetMonth || r.month === 'default';
  });

  const resolved = new Map<string, BudgetRow>();
  // 先放 default，再以 targetMonth 覆蓋
  for (const r of layerRows) {
    if (r.month === 'default') {
      resolved.set(r.category, r);
    }
  }
  for (const r of layerRows) {
    if (r.month === targetMonth) {
      resolved.set(r.category, r);
    }
  }
  return resolved;
}

export function calculateEffectiveTotalBudgetForMonth(
  rows: BudgetRow[],
  targetMonth: string,
  scope: string,
  userId: string
): {
  manualTotal: number;
  personalManualTotal: number;
  sharedManualTotal: number;
  categorySum: number;
  effectiveTotal: number;
  personalMap: Map<string, BudgetRow>;
  sharedMap: Map<string, BudgetRow>;
} {
  const personalMap = scope !== 'household'
    ? resolveLayerBudgets(rows, targetMonth, 0, userId)
    : new Map<string, BudgetRow>();
  const sharedMap = scope !== 'personal'
    ? resolveLayerBudgets(rows, targetMonth, 1)
    : new Map<string, BudgetRow>();

  const personalManualTotal = Number(personalMap.get(TOTAL_BUDGET_CATEGORY)?.amount || 0);
  const sharedManualTotal = Number(sharedMap.get(TOTAL_BUDGET_CATEGORY)?.amount || 0);
  const manualTotal =
    scope === 'household'
      ? sharedManualTotal
      : scope === 'personal'
      ? personalManualTotal
      : personalManualTotal + sharedManualTotal;

  const allCategories = new Set<string>();
  for (const k of personalMap.keys()) {
    if (k !== TOTAL_BUDGET_CATEGORY) allCategories.add(k);
  }
  for (const k of sharedMap.keys()) {
    if (k !== TOTAL_BUDGET_CATEGORY) allCategories.add(k);
  }

  let categorySum = 0;
  for (const cat of allCategories) {
    const pAmt = Number(personalMap.get(cat)?.amount || 0);
    const sAmt = Number(sharedMap.get(cat)?.amount || 0);
    const amt = scope === 'household' ? sAmt : scope === 'personal' ? pAmt : pAmt + sAmt;
    if (amt > 0) categorySum += amt;
  }

  const effectiveTotal = Math.max(manualTotal, categorySum);
  return {
    manualTotal,
    personalManualTotal,
    sharedManualTotal,
    categorySum,
    effectiveTotal,
    personalMap,
    sharedMap,
  };
}

/**
 * 查詢並計算指定月份與視角（all | household | personal）之完整預算與日常消費數據 (ADR-0046)
 */
export async function computeScopedBudgets(
  db: any,
  userId: string,
  memberUserIds: string[],
  month: string,
  scope = 'all'
): Promise<ScopedBudgetSummary> {
  await ensureBudgetsSchema(db);
  const placeholders = memberUserIds.map(() => '?').join(',');

  let spendCondition = `((user_id = ? AND is_shared = 0) OR (user_id IN (${placeholders}) AND is_shared = 1))`;
  let spendParams: (string | number)[] = [userId, ...memberUserIds];

  if (scope === 'household') {
    spendCondition = `user_id IN (${placeholders}) AND is_shared = 1`;
    spendParams = [...memberUserIds];
  } else if (scope === 'personal') {
    spendCondition = `user_id = ? AND is_shared = 0`;
    spendParams = [userId];
  }

  const [budgetRowsRes, spendRowsRes] = await Promise.all([
    db.prepare(`
      SELECT id, user_id, category, amount, month, COALESCE(is_shared, 0) as is_shared
      FROM budgets
      WHERE (user_id = ? OR (user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1))
        AND (month = ? OR month = 'default')
    `).bind(userId, ...memberUserIds, month).all(),
    db.prepare(`
      SELECT category, SUM(amount) as spent
      FROM transactions
      WHERE ${spendCondition}
        AND date >= ? AND date <= ?
        AND type = 'expense'
        AND category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
      GROUP BY category
    `).bind(...spendParams, `${month}-01`, `${month}-31`).all(),
  ]);

  const rawBudgets = ((budgetRowsRes.results || []) as BudgetRow[]).filter(r => Number(r.amount) > 0);
  const spendRows = (spendRowsRes.results || []) as Array<{ category: string; spent: number }>;

  const spentMap: Record<string, number> = {};
  let totalSpent = 0;
  for (const r of spendRows) {
    const val = Number(r.spent || 0);
    spentMap[r.category] = val;
    totalSpent += val;
  }

  const {
    manualTotal,
    personalManualTotal,
    sharedManualTotal,
    categorySum,
    effectiveTotal,
    personalMap,
    sharedMap,
  } = calculateEffectiveTotalBudgetForMonth(rawBudgets, month, scope, userId);

  const allCategories = new Set<string>();
  for (const k of personalMap.keys()) {
    if (k !== TOTAL_BUDGET_CATEGORY) allCategories.add(k);
  }
  for (const k of sharedMap.keys()) {
    if (k !== TOTAL_BUDGET_CATEGORY) allCategories.add(k);
  }

  const items: ScopedBudgetItem[] = [];
  for (const cat of allCategories) {
    const pRow = personalMap.get(cat);
    const sRow = sharedMap.get(cat);
    const pAmt = Number(pRow?.amount || 0);
    const sAmt = Number(sRow?.amount || 0);
    const amount = scope === 'household' ? sAmt : scope === 'personal' ? pAmt : pAmt + sAmt;
    if (amount <= 0) continue;

    const primaryRow = (scope === 'household' ? sRow : scope === 'personal' ? pRow : (pRow || sRow))!;
    const spent = spentMap[cat] || 0;
    const isSharedFlag = scope === 'household' ? 1 : scope === 'personal' ? 0 : (sAmt > 0 && pAmt === 0 ? 1 : 0);

    items.push({
      id: primaryRow.id,
      user_id: primaryRow.user_id,
      category: cat,
      amount,
      month,
      is_shared: isSharedFlag,
      is_persistent: primaryRow.month === 'default',
      personal_amount: pAmt,
      shared_amount: sAmt,
      spent,
      over: spent > amount,
    });
  }

  const remainingBudget = Math.max(0, effectiveTotal - totalSpent);

  return {
    month,
    scope,
    manual_total_budget: manualTotal,
    personal_manual_total_budget: personalManualTotal,
    shared_manual_total_budget: sharedManualTotal,
    category_budget_sum: categorySum,
    effective_total_budget: effectiveTotal,
    total_spent: totalSpent,
    remaining_budget: remainingBudget,
    over_budget: effectiveTotal > 0 && totalSpent > effectiveTotal,
    items,
  };
}

// GET /budgets?month=YYYY-MM&scope=all|household|personal
budgets.get('/', async (c) => {
  const userId = c.get('userId');
  const month = c.req.query('month') || getTaipeiDateString().slice(0, 7);
  const scope = c.req.query('scope') || 'all';
  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);

  const summary = await computeScopedBudgets(c.env.DB, userId, memberUserIds, month, scope);

  return c.json({
    success: true,
    data: summary.items,
    summary: {
      month: summary.month,
      scope: summary.scope,
      manual_total_budget: summary.manual_total_budget,
      personal_manual_total_budget: summary.personal_manual_total_budget,
      shared_manual_total_budget: summary.shared_manual_total_budget,
      category_budget_sum: summary.category_budget_sum,
      effective_total_budget: summary.effective_total_budget,
      total_spent: summary.total_spent,
      remaining_budget: summary.remaining_budget,
      over_budget: summary.over_budget,
    },
  });
});

// PUT /budgets — upsert (支援 month = 'default' 常駐預設或 'YYYY-MM'，及 is_shared = 0 | 1；若 amount <= 0 則清除該項預算)
budgets.put('/', async (c) => {
  const userId = c.get('userId');
  await ensureBudgetsSchema(c.env.DB);
  const body = await c.req.json();
  const { category, amount, month = 'default', is_shared = 0 } = body;
  if (!category) return c.json({ success: false, error: '請填寫預算分類' }, 400);

  const targetMonth = month || 'default';
  const sharedFlag = Number(is_shared) ? 1 : 0;
  const numAmount = Number(amount);

  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  // 若 amount <= 0，執行清除該分類在該歸屬層級之預算（包含 default 與指定月份）
  if (isNaN(numAmount) || numAmount <= 0) {
    if (sharedFlag === 1) {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ? AND (month = ? OR month = 'default')`
      ).bind(...memberUserIds, category, targetMonth).run();
    } else {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ? AND (month = ? OR month = 'default')`
      ).bind(userId, category, targetMonth).run();
    }
    return c.json({ success: true, data: null });
  }

  if (sharedFlag === 1) {
    // 家庭公帳預算由全體家庭成員協作共管：維持該家庭在同一 (category, month, is_shared=1) 僅單一紀錄
    const existing = await c.env.DB.prepare(
      `SELECT id FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ? AND month = ?`
    ).bind(...memberUserIds, category, targetMonth).first<{ id: string }>();

    if (existing) {
      await c.env.DB.prepare('UPDATE budgets SET amount = ?, user_id = ? WHERE id = ?')
        .bind(numAmount, userId, existing.id).run();
    } else {
      const id = generateId();
      await c.env.DB.prepare(
        'INSERT INTO budgets (id, user_id, category, amount, month, is_shared) VALUES (?, ?, ?, ?, ?, 1)'
      ).bind(id, userId, category, numAmount, targetMonth).run();
    }
    // 若使用者以 'default' 常駐預設更新，一併清除過去殘留的特定月份覆寫，使新常駐額度立即在當月生效
    if (targetMonth === 'default') {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ? AND month != 'default'`
      ).bind(...memberUserIds, category).run();
    }

    const row = await c.env.DB.prepare(
      `SELECT * FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ? AND month = ?`
    ).bind(...memberUserIds, category, targetMonth).first();
    return c.json({ success: true, data: row });
  } else {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ? AND month = ?'
    ).bind(userId, category, targetMonth).first<{ id: string }>();

    if (existing) {
      await c.env.DB.prepare('UPDATE budgets SET amount = ? WHERE id = ?')
        .bind(numAmount, existing.id).run();
    } else {
      const id = generateId();
      await c.env.DB.prepare(
        'INSERT INTO budgets (id, user_id, category, amount, month, is_shared) VALUES (?, ?, ?, ?, ?, 0)'
      ).bind(id, userId, category, numAmount, targetMonth).run();
    }
    if (targetMonth === 'default') {
      await c.env.DB.prepare(
        "DELETE FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ? AND month != 'default'"
      ).bind(userId, category).run();
    }

    const row = await c.env.DB.prepare(
      'SELECT * FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ? AND month = ?'
    ).bind(userId, category, targetMonth).first();
    return c.json({ success: true, data: row });
  }
});

// DELETE /budgets?category=XXX&is_shared=0|1&month=YYYY-MM
budgets.delete('/', async (c) => {
  const userId = c.get('userId');
  await ensureBudgetsSchema(c.env.DB);
  const category = c.req.query('category');
  const isShared = Number(c.req.query('is_shared') || 0) ? 1 : 0;
  const month = c.req.query('month');

  if (!category) return c.json({ success: false, error: '請指定要清除的預算分類' }, 400);

  const { memberUserIds } = await getUserHousehold(c.env.DB, userId);
  const placeholders = memberUserIds.map(() => '?').join(',');

  if (isShared === 1) {
    if (month && month !== 'default') {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ? AND (month = ? OR month = 'default')`
      ).bind(...memberUserIds, category, month).run();
    } else {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id IN (${placeholders}) AND COALESCE(is_shared, 0) = 1 AND category = ?`
      ).bind(...memberUserIds, category).run();
    }
  } else {
    if (month && month !== 'default') {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ? AND (month = ? OR month = 'default')`
      ).bind(userId, category, month).run();
    } else {
      await c.env.DB.prepare(
        `DELETE FROM budgets WHERE user_id = ? AND COALESCE(is_shared, 0) = 0 AND category = ?`
      ).bind(userId, category).run();
    }
  }

  return c.json({ success: true, data: { deleted: true, category, is_shared: isShared } });
});

export default budgets;
