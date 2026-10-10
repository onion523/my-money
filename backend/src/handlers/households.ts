import { getTaipeiDateString } from '../utils/date';
import { Hono } from 'hono';
import { Env, Household, HouseholdMember } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { ensureAccountsSchema } from './accounts';

type Vars = { userId: string; userEmail: string; userName: string };
const households = new Hono<{ Bindings: Env; Variables: Vars }>();
households.use('*', authMiddleware);

export async function getUserHousehold(db: D1Database, userId: string): Promise<{ household: Household | null; memberUserIds: string[]; myRole: 'admin' | 'member' | null }> {
  const rows = await db.prepare(`
    SELECT
      hm.user_id,
      hm.role,
      h.id as h_id,
      h.name as h_name,
      h.created_by as h_created_by,
      h.created_at as h_created_at
    FROM household_members hm
    LEFT JOIN households h ON hm.household_id = h.id
    WHERE hm.household_id = (SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1)
  `).bind(userId).all<{
    user_id: string;
    role: 'admin' | 'member';
    h_id: string | null;
    h_name: string | null;
    h_created_by: string | null;
    h_created_at: string | null;
  }>();

  const list = rows.results || [];
  if (list.length === 0) {
    return { household: null, memberUserIds: [userId], myRole: null };
  }

  const memberUserIds = list.map(m => m.user_id);
  if (!memberUserIds.includes(userId)) memberUserIds.push(userId);

  const myRow = list.find(m => m.user_id === userId);
  const first = list[0];
  const household: Household | null = first.h_id
    ? {
        id: first.h_id,
        name: first.h_name || '',
        created_by: first.h_created_by || '',
        created_at: first.h_created_at || '',
      }
    : null;

  return { household, memberUserIds, myRole: myRow?.role || 'member' };
}

// GET /households/current
households.get('/current', async (c) => {
  const userId = c.get('userId');
  const { household, myRole } = await getUserHousehold(c.env.DB, userId);
  if (!household) {
    return c.json({ success: true, data: { household: null, members: [], myRole: null } });
  }

  const membersResult = await c.env.DB.prepare(`
    SELECT hm.id, hm.household_id, hm.user_id, hm.role, hm.joined_at, u.name, u.email
    FROM household_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.household_id = ?
    ORDER BY hm.role DESC, hm.joined_at ASC
  `).bind(household.id).all();

  // Active invitation if any
  const inv = await c.env.DB.prepare(`
    SELECT code, expires_at FROM household_invitations
    WHERE household_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(household.id).first<{ code: string; expires_at: string }>();

  return c.json({
    success: true,
    data: {
      household,
      members: membersResult.results,
      myRole: myRole || 'member',
      activeInvitation: inv || null,
    }
  });
});

// POST /households (Create household)
households.post('/', async (c) => {
  const userId = c.get('userId');
  const { name } = await c.req.json();
  if (!name || !name.trim()) return c.json({ success: false, error: '請輸入家庭名稱' }, 400);

  // Check if user already in a household
  const existing = await c.env.DB.prepare('SELECT id FROM household_members WHERE user_id = ?').bind(userId).first();
  if (existing) return c.json({ success: false, error: '你已經在一個家庭群組中，請先退出目前家庭' }, 400);

  const householdId = generateId();
  const memberId = generateId();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)')
      .bind(householdId, name.trim(), userId),
    c.env.DB.prepare('INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)')
      .bind(memberId, householdId, userId, 'admin'),
  ]);

  return c.json({
    success: true,
    data: { id: householdId, name: name.trim(), role: 'admin' }
  }, 201);
});

// POST /households/invite (Generate invite code)
households.post('/invite', async (c) => {
  const userId = c.get('userId');
  const { household, myRole } = await getUserHousehold(c.env.DB, userId);
  if (!household) return c.json({ success: false, error: '尚未建立或加入家庭群組' }, 400);
  if (myRole !== 'admin') {
    return c.json({ success: false, error: '權限不足：只有家庭管理員可以生成邀請碼' }, 403);
  }

  // Generate 6-char random alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FAM-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  const id = generateId();
  // 7 days expiry
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(`
    INSERT INTO household_invitations (id, household_id, code, inviter_id, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, household.id, code, userId, expiresAt).run();

  return c.json({ success: true, data: { code, expires_at: expiresAt } });
});

// POST /households/join (Join with invite code)
households.post('/join', async (c) => {
  const userId = c.get('userId');
  const { code } = await c.req.json();
  if (!code || !code.trim()) return c.json({ success: false, error: '請輸入邀請碼' }, 400);

  const cleanCode = code.trim().toUpperCase();

  // Check if user already in a household
  const existing = await c.env.DB.prepare('SELECT id FROM household_members WHERE user_id = ?').bind(userId).first();
  if (existing) return c.json({ success: false, error: '你已經加入家庭群組，無法重複加入' }, 400);

  // Validate invitation
  const inv = await c.env.DB.prepare(`
    SELECT * FROM household_invitations
    WHERE UPPER(code) = ? AND expires_at > datetime('now')
  `).bind(cleanCode).first<{ id: string; household_id: string }>();

  if (!inv) return c.json({ success: false, error: '邀請碼無效或已過期' }, 404);

  const household = await c.env.DB.prepare('SELECT * FROM households WHERE id = ?').bind(inv.household_id).first<Household>();
  if (!household) return c.json({ success: false, error: '家庭群組不存在' }, 404);

  const memberId = generateId();
  await c.env.DB.prepare('INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)')
    .bind(memberId, household.id, userId, 'member').run();

  return c.json({ success: true, data: { household, role: 'member' } });
});

// DELETE /households/leave
households.delete('/leave', async (c) => {
  const userId = c.get('userId');
  const member = await c.env.DB.prepare('SELECT * FROM household_members WHERE user_id = ?').bind(userId).first<{ id: string; household_id: string; role: string }>();
  if (!member) return c.json({ success: false, error: '你未加入任何家庭' }, 400);

  // Count members
  const countRes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM household_members WHERE household_id = ?').bind(member.household_id).first<{ count: number }>();
  
  if (countRes && countRes.count <= 1) {
    // Last member leaves, delete the household
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(member.household_id),
      c.env.DB.prepare('DELETE FROM household_invitations WHERE household_id = ?').bind(member.household_id),
      c.env.DB.prepare('DELETE FROM households WHERE id = ?').bind(member.household_id),
    ]);
  } else {
    // If admin leaves, transfer admin to someone else
    if (member.role === 'admin') {
      const nextMember = await c.env.DB.prepare('SELECT id FROM household_members WHERE household_id = ? AND user_id != ? LIMIT 1')
        .bind(member.household_id, userId).first<{ id: string }>();
      if (nextMember) {
        await c.env.DB.prepare("UPDATE household_members SET role = 'admin' WHERE id = ?").bind(nextMember.id).run();
      }
    }
    await c.env.DB.prepare('DELETE FROM household_members WHERE user_id = ?').bind(userId).run();
  }

  return c.json({ success: true, message: '已離開家庭群組' });
});

// DELETE /households/members/:targetUserId
households.delete('/members/:targetUserId', async (c) => {
  const userId = c.get('userId');
  const targetUserId = c.req.param('targetUserId');

  const myMember = await c.env.DB.prepare('SELECT * FROM household_members WHERE user_id = ?').bind(userId).first<{ household_id: string; role: string }>();
  if (!myMember || myMember.role !== 'admin') {
    return c.json({ success: false, error: '權限不足：只有家庭管理員可以移除成員' }, 403);
  }

  if (targetUserId === userId) {
    return c.json({ success: false, error: '請使用離開家庭群組功能' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
    .bind(myMember.household_id, targetUserId).run();

  return c.json({ success: true, message: '已移除成員' });
});


// GET /households/advances (家庭代墊款待報銷統計與明細 — 批次查詢聚合)
households.get('/advances', async (c) => {
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { household, memberUserIds } = await getUserHousehold(c.env.DB, userId);
  if (!household) return c.json({ success: true, data: [] });

  const placeholders = memberUserIds.map(() => '?').join(',');

  const [membersResult, allSharedPersonalExpenses, allReimbIncomes, allReceivingAccounts] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT hm.user_id, u.name, u.email
      FROM household_members hm
      JOIN users u ON hm.user_id = u.id
      WHERE hm.household_id = ?
    `).bind(household.id),
    c.env.DB.prepare(`
      SELECT t.id, t.user_id, t.date, t.created_at, t.category, t.note, t.amount, t.reimbursement_id,
             COALESCE(a.name, '個人帳戶') as account_name, COALESCE(a.type, 'other') as account_type
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id IN (${placeholders})
        AND t.is_shared = 1
        AND t.type = 'expense'
        AND (a.is_joint = 0 OR a.is_joint IS NULL)
        AND t.category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
      ORDER BY t.date DESC, t.created_at DESC, t.rowid DESC
    `).bind(...memberUserIds),
    c.env.DB.prepare(`
      SELECT t.id, t.user_id, t.date, t.created_at, t.amount, t.note, COALESCE(a.name, '收款帳戶') as account_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id IN (${placeholders}) AND t.category = '公帳代墊報銷' AND t.type = 'income'
      ORDER BY t.date DESC, t.created_at DESC, t.rowid DESC
    `).bind(...memberUserIds),
    c.env.DB.prepare(`
      SELECT id, user_id, name, type
      FROM accounts
      WHERE user_id IN (${placeholders}) AND is_joint = 0 AND type IN ('bank', 'cash')
      ORDER BY created_at ASC
    `).bind(...memberUserIds),
  ]);

  const members = (membersResult.results as any[]) || [];
  const expenseRows = (allSharedPersonalExpenses.results as any[]) || [];
  const reimbRows = (allReimbIncomes.results as any[]) || [];
  const recvAccRows = (allReceivingAccounts.results as any[]) || [];

  const healBatchStmts: any[] = [];

  const advances = members.map((m) => {
    const myExpenses = expenseRows.filter(r => r.user_id === m.user_id);
    const myReimbs = reimbRows.filter(r => r.user_id === m.user_id);
    const myRecvAccs = recvAccRows
      .filter(r => r.user_id === m.user_id)
      .map(({ id, name, type }) => ({ id, name, type }));

    const totalAdvanced = myExpenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalReimbursed = myReimbs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const linkedTotal = myExpenses
      .filter(r => r.reimbursement_id && String(r.reimbursement_id).trim() !== '')
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    // 若有舊版未關聯之歷史報銷差額，收集至單一批次自癒並同步反映於記憶體清單
    if (totalReimbursed > linkedTotal) {
      let toLink = totalReimbursed - linkedTotal;
      const unlinkedOldestFirst = [...myExpenses]
        .filter(r => !r.reimbursement_id || String(r.reimbursement_id).trim() === '')
        .reverse();
      for (const it of unlinkedOldestFirst) {
        if (it.amount <= toLink) {
          it.reimbursement_id = 'historical_reimbursement';
          healBatchStmts.push(
            c.env.DB.prepare("UPDATE transactions SET reimbursement_id = 'historical_reimbursement' WHERE id = ?").bind(it.id)
          );
          toLink -= it.amount;
        } else {
          break;
        }
      }
    }

    const advanceItems = myExpenses
      .filter(r => !r.reimbursement_id || String(r.reimbursement_id).trim() === '')
      .map(({ id, date, created_at, category, note, amount, account_name, account_type }) => ({
        id, date, created_at, category, note, amount, account_name, account_type
      }));

    const reimbursementItems = myReimbs.map(({ id, date, created_at, amount, note, account_name }) => ({
      id, date, created_at, amount, note, account_name
    }));

    const pendingReimburse = advanceItems.reduce((s, it) => s + Number(it.amount || 0), 0);

    return {
      user_id: m.user_id,
      user_name: m.name,
      email: m.email,
      total_advanced: totalAdvanced,
      total_reimbursed: totalReimbursed,
      pending_reimburse: pendingReimburse,
      advance_items: advanceItems,
      reimbursement_items: reimbursementItems,
      receiving_accounts: myRecvAccs
    };
  });

  if (healBatchStmts.length > 0) {
    await c.env.DB.batch(healBatchStmts);
  }

  return c.json({ success: true, data: advances });
});

// POST /households/reimburse (從共同基金撥款報銷代墊款，支援勾選指定明細分批沖帳)
households.post('/reimburse', async (c) => {
  await ensureAccountsSchema(c.env.DB);
  const userId = c.get('userId');
  const { household, memberUserIds, myRole } = await getUserHousehold(c.env.DB, userId);
  if (!household) return c.json({ success: false, error: '尚未建立或加入家庭群組' }, 400);

  const body = await c.req.json();
  const { target_user_id, from_account_id, to_account_id, amount, date = getTaipeiDateString(), note = '', advance_ids } = body;
  const amt = Number(amount);

  if (!target_user_id || !from_account_id || !to_account_id || isNaN(amt) || amt <= 0) {
    return c.json({ success: false, error: '請填寫正確報銷資訊與金額' }, 400);
  }

  // 受限自律報銷防線：一般成員僅能為本人代墊款執行撥款報銷
  if (myRole !== 'admin' && target_user_id !== userId) {
    return c.json({ success: false, error: '權限不足：一般成員僅能為本人代墊款執行撥款報銷，無法動支撥款給其他成員' }, 403);
  }

  const placeholders = memberUserIds.map(() => '?').join(',');
  const fromAcc = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND user_id IN (${placeholders}) AND is_joint = 1`
  ).bind(from_account_id, ...memberUserIds).first<any>();

  if (!fromAcc || (fromAcc.type !== 'bank' && fromAcc.type !== 'cash')) {
    return c.json({ success: false, error: '撥款帳戶必須為家庭共同基金之銀行存款帳戶或現金錢包' }, 400);
  }
  if (fromAcc.balance < amt) {
    return c.json({ success: false, error: `家庭共同基金餘額不足（目前餘額：NT$ ${fromAcc.balance.toLocaleString()}）` }, 400);
  }

  const toAcc = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(to_account_id, target_user_id).first<any>();

  if (!toAcc) {
    return c.json({ success: false, error: '找不到收款成員之個人帳戶' }, 404);
  }
  if (toAcc.type !== 'bank' && toAcc.type !== 'cash') {
    return c.json({ success: false, error: '收款帳戶必須為銀行存款帳戶或現金錢包' }, 400);
  }

  const targetUser = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(target_user_id).first<{ name: string }>();
  const targetName = targetUser?.name || '成員';

  const outTxId = generateId();
  const inTxId = generateId();

  const writeStmts: any[] = [
    c.env.DB.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(amt, from_account_id),
    c.env.DB.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(amt, to_account_id),
    c.env.DB.prepare(
      'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(outTxId, userId, from_account_id, 'expense', '公帳代墊報銷', amt, note ? `${note} (撥款至 ${targetName} ${toAcc.name})` : `撥款報銷代墊款給 ${targetName} (${toAcc.name})`, date, 1),
    c.env.DB.prepare(
      'INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(inTxId, target_user_id, to_account_id, 'income', '公帳代墊報銷', amt, note ? `${note} (來自家庭基金 ${fromAcc.name})` : `收到公帳代墊報銷款 (來自 ${fromAcc.name})`, date, 0),
  ];

  // 關聯結清選定之代墊明細
  if (Array.isArray(advance_ids) && advance_ids.length > 0) {
    for (const advId of advance_ids) {
      writeStmts.push(
        c.env.DB.prepare(
          'UPDATE transactions SET reimbursement_id = ? WHERE id = ? AND user_id = ?'
        ).bind(inTxId, advId, target_user_id)
      );
    }
  } else {
    // 容錯 fallback：依時間順序將未結清代墊對齊至該報銷款
    let remainingAmt = amt;
    const unlinked = await c.env.DB.prepare(`
      SELECT t.id, t.amount
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id = ? 
        AND t.is_shared = 1 
        AND t.type = 'expense'
        AND (a.is_joint = 0 OR a.is_joint IS NULL)
        AND t.category NOT IN ('信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷')
        AND (t.reimbursement_id IS NULL OR t.reimbursement_id = '')
      ORDER BY t.date ASC, t.created_at ASC, t.rowid ASC
    `).bind(target_user_id).all();
    for (const it of (unlinked.results as any[])) {
      if (it.amount <= remainingAmt) {
        writeStmts.push(
          c.env.DB.prepare('UPDATE transactions SET reimbursement_id = ? WHERE id = ? AND user_id = ?')
            .bind(inTxId, it.id, target_user_id)
        );
        remainingAmt -= it.amount;
      }
    }
  }

  await c.env.DB.batch(writeStmts);

  return c.json({
    success: true,
    data: {
      message: `成功從共同基金撥款報銷 NT$ ${amt.toLocaleString()} 給 ${targetName}！`,
      from_balance: fromAcc.balance - amt,
      to_balance: toAcc.balance + amt
    }
  });
});

export default households;
