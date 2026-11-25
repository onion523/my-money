import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, USER2, type Harness } from './harness';

describe('Scoped Persistent Budget System & Cashflow Reserve (ADR-0046, #235, #236)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW); // 2026-06-15 in Taipei
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  it('supports persistent default budgets across months, shared vs personal layers, all-scope aggregation, smart total budget, delete/clear, disposable cash reserve, and forecast budget deduction toggle', async () => {
    // 1. Set a persistent personal budget for '娛樂' = 4000 (month: 'default', is_shared: 0)
    const putPersonal = await h.request('/budgets', {
      method: 'PUT',
      user: USER1,
      body: { category: '娛樂', amount: 4000, month: 'default', is_shared: 0 },
    });
    expect(putPersonal.status).toBe(200);
    expect(putPersonal.json.data.is_shared).toBe(0);
    expect(putPersonal.json.data.month).toBe('default');

    // 2. Set a persistent household budget for '娛樂' = 6000 by USER2 (collaborative household budget)
    const putShared = await h.request('/budgets', {
      method: 'PUT',
      user: USER2,
      body: { category: '娛樂', amount: 6000, month: 'default', is_shared: 1 },
    });
    expect(putShared.status).toBe(200);
    expect(putShared.json.data.is_shared).toBe(1);

    // 3. Query personal scope in a future month (2026-09): persistent budget automatically applies!
    const pRes = await h.request('/budgets?month=2026-09&scope=personal', { user: USER1 });
    expect(pRes.status).toBe(200);
    const pEnt = pRes.json.data.find((b: any) => b.category === '娛樂');
    expect(pEnt).toBeDefined();
    expect(pEnt.amount).toBe(4000);
    expect(pEnt.is_persistent).toBe(true);

    // 4. Query household scope in 2026-09 by USER1: sees the 6000 household budget set by USER2
    const hRes = await h.request('/budgets?month=2026-09&scope=household', { user: USER1 });
    expect(hRes.status).toBe(200);
    const hEnt = hRes.json.data.find((b: any) => b.category === '娛樂');
    expect(hEnt).toBeDefined();
    expect(hEnt.amount).toBe(6000);

    // 5. Query all scope in 2026-09 by USER1: aggregates personal (4000) + household (6000) = 10000
    const allRes = await h.request('/budgets?month=2026-09&scope=all', { user: USER1 });
    expect(allRes.status).toBe(200);
    const allEnt = allRes.json.data.find((b: any) => b.category === '娛樂');
    expect(allEnt).toBeDefined();
    expect(allEnt.amount).toBe(10000);
    expect(allEnt.personal_amount).toBe(4000);
    expect(allEnt.shared_amount).toBe(6000);

    // 6. Smart Monthly Total Budget (__TOTAL__):
    // Currently in household scope, category_budget_sum is 6000, manual_total_budget is 0 => effective_total_budget = 6000
    expect(hRes.json.summary.category_budget_sum).toBe(6000);
    expect(hRes.json.summary.manual_total_budget).toBe(0);
    expect(hRes.json.summary.effective_total_budget).toBe(6000);

    // Set manual household total budget (__TOTAL__) = 50000 (> 6000 and > June shared spent) => effective_total_budget becomes 50000
    const putManualTotal = await h.request('/budgets', {
      method: 'PUT',
      user: USER1,
      body: { category: '__TOTAL__', amount: 50000, month: 'default', is_shared: 1 },
    });
    expect(putManualTotal.status).toBe(200);

    const hResAfterTotal = await h.request('/budgets?month=2026-06&scope=household', { user: USER1 });
    expect(hResAfterTotal.status).toBe(200);
    expect(hResAfterTotal.json.summary.manual_total_budget).toBe(50000);
    expect(hResAfterTotal.json.summary.effective_total_budget).toBe(50000);

    // 7. Verify GET /accounts/balance includes monthlyBudget, monthSpent, remainingBudget, and deducts remainingBudget from disposable
    const balHousehold = await h.request('/accounts/balance?scope=household', { user: USER1 });
    expect(balHousehold.status).toBe(200);
    const bData = balHousehold.json.data;
    expect(bData.monthlyBudget).toBe(50000);
    expect(bData.remainingBudget).toBeGreaterThan(0);
    expect(bData.remainingBudget).toBe(Math.max(0, 50000 - bData.monthSpent));
    expect(Math.round((bData.available - bData.monthlyFixed - bData.monthlyGoals - bData.remainingBudget) * 100) / 100)
      .toBe(Math.round(bData.disposable * 100) / 100);

    // 8. Verify GET /forecast with include_budget=0 vs include_budget=1
    const fcWithoutBudget = await h.request('/forecast?scope=household', { user: USER1 });
    expect(fcWithoutBudget.status).toBe(200);
    expect(fcWithoutBudget.json.data.events.some((e: any) => String(e.event_key).startsWith('budget:'))).toBe(false);

    const fcWithBudget = await h.request('/forecast?scope=household&include_budget=1', { user: USER1 });
    expect(fcWithBudget.status).toBe(200);
    const budgetEvents = fcWithBudget.json.data.events.filter((e: any) => String(e.event_key).startsWith('budget:'));
    expect(budgetEvents.length).toBeGreaterThanOrEqual(12);
    // Current month (2026-06) event uses remainingBudget on 2026-06-30
    const juneBudgetEv = budgetEvents.find((e: any) => e.event_key === 'budget:household:2026-06');
    expect(juneBudgetEv).toBeDefined();
    expect(juneBudgetEv.date).toBe('2026-06-30');
    expect(juneBudgetEv.amount).toBe(Math.round(bData.remainingBudget * 100) / 100);
    // Future month (2026-07) event uses full effective_total_budget (50000) on 2026-07-31
    const julyBudgetEv = budgetEvents.find((e: any) => e.event_key === 'budget:household:2026-07');
    expect(julyBudgetEv).toBeDefined();
    expect(julyBudgetEv.date).toBe('2026-07-31');
    expect(julyBudgetEv.amount).toBe(50000);

    // 9. Verify DELETE /budgets clears the configured budgets
    const delTotal = await h.request(`/budgets?category=${encodeURIComponent('__TOTAL__')}&is_shared=1`, {
      method: 'DELETE',
      user: USER1,
    });
    expect(delTotal.status).toBe(200);

    const delSharedEnt = await h.request(`/budgets?category=${encodeURIComponent('娛樂')}&is_shared=1`, {
      method: 'DELETE',
      user: USER1,
    });
    expect(delSharedEnt.status).toBe(200);

    const delPersonalEnt = await h.request(`/budgets?category=${encodeURIComponent('娛樂')}&is_shared=0`, {
      method: 'DELETE',
      user: USER1,
    });
    expect(delPersonalEnt.status).toBe(200);

    const hResCleaned = await h.request('/budgets?month=2026-06&scope=household', { user: USER1 });
    expect(hResCleaned.json.summary.effective_total_budget).toBe(0);
    expect(hResCleaned.json.data.length).toBe(0);
  });

  it('#241: excludes personal advances for shared expenses (is_shared=1) from personal scope (transactions, category summary, monthly summary) and supports exclude_system=1 on monthly summary', async () => {
    // 1. Record a shared advance (is_shared = 1) paid by USER1's private cash wallet (a_cash1) in 2026-06
    const advRes = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: 'a_cash1',
        type: 'expense',
        category: '寵物毛孩',
        amount: 3333,
        note: '代墊買家庭貓砂',
        date: '2026-06-15',
        is_shared: 1,
      },
    });
    expect(advRes.status).toBe(201);
    const advTx = advRes.json.data;

    // 2. Verify personal scope (scope=personal) does NOT include this shared advance in transaction list, category summary, or monthly summary
    const personalTxs = await h.request('/transactions?scope=personal&from=2026-06-01&to=2026-06-30&limit=200', { user: USER1 });
    expect(personalTxs.status).toBe(200);
    expect(personalTxs.json.data.every((t: any) => t.is_shared === 0)).toBe(true);
    expect(personalTxs.json.data.some((t: any) => t.id === advTx.id)).toBe(false);

    const personalCat = await h.request('/transactions/summary/category?month=2026-06&scope=personal', { user: USER1 });
    expect(personalCat.status).toBe(200);
    expect(personalCat.json.data.find((c: any) => c.category === '寵物毛孩')).toBeUndefined();

    // Household scope and All scope DO include this shared advance
    const householdCat = await h.request('/transactions/summary/category?month=2026-06&scope=household', { user: USER1 });
    expect(householdCat.status).toBe(200);
    expect(householdCat.json.data.find((c: any) => c.category === '寵物毛孩')?.total).toBe(3333);

    // 3. Verify GET /transactions/summary/monthly?exclude_system=1 excludes '信用卡還款' (4500) and '內部轉帳' (1000) in 2026-05
    const monthlyFull = await h.request('/transactions/summary/monthly?year=2026&scope=personal', { user: USER1 });
    const monthlyNoSys = await h.request('/transactions/summary/monthly?year=2026&scope=personal&exclude_system=1', { user: USER1 });
    expect(monthlyFull.status).toBe(200);
    expect(monthlyNoSys.status).toBe(200);

    const mayFullExp = monthlyFull.json.data.find((m: any) => m.month === '2026-05' && m.type === 'expense')?.total || 0;
    const mayNoSysExp = monthlyNoSys.json.data.find((m: any) => m.month === '2026-05' && m.type === 'expense')?.total || 0;
    // In seed(), 2026-05 has '信用卡還款' 4500 and '內部轉帳' 1000 with is_shared=0 for USER1
    expect(Math.round((mayFullExp - mayNoSysExp) * 100) / 100).toBe(5500);

    // Clean up
    await h.request(`/transactions/${advTx.id}`, { method: 'DELETE', user: USER1 });
  });
});
