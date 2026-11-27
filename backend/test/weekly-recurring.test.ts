import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, type Harness } from './harness';

describe('Weekly Recurring Items (#232, #233)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW); // 2026-06-15 (Monday) in Taipei
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  it('supports creating, updating, amortizing (x4), forecasting (bank & credit card due shift without event_key collision), settling, and CSV export for weekly recurring items', async () => {
    // 1. Check baseline amortize & balance before adding weekly item
    const baseAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(baseAmort.status).toBe(200);
    const baseMonthlyExp = Number(baseAmort.json.data.monthly_expense || 0);

    const baseBal = await h.request('/accounts/balance?scope=personal', { user: USER1 });
    expect(baseBal.status).toBe(200);
    const baseFixed = Number(baseBal.json.data.monthlyFixed || 0);

    // 2. Create a weekly expense on bank account (every Wednesday = 3, amount = 500 => monthly = 2000)
    const createBankWeekly = await h.request('/recurring', {
      method: 'POST',
      user: USER1,
      body: {
        name: '每週教練課',
        type: 'expense',
        amount: 500,
        cycle: 'weekly',
        day_of_cycle: 3, // 週三
        account_id: 'a_bank1',
        is_shared: 0,
      },
    });
    expect(createBankWeekly.status).toBe(201);
    const bankWeekly = createBankWeekly.json.data;
    expect(bankWeekly.cycle).toBe('weekly');
    expect(bankWeekly.day_of_cycle).toBe(3);
    expect(bankWeekly.month_of_cycle).toBe(1);

    // 3. Verify amortization & disposable cash monthlyFixed increased by 500 * 4 = 2000
    const nextAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(nextAmort.status).toBe(200);
    expect(Number(nextAmort.json.data.monthly_expense)).toBe(baseMonthlyExp + 2000);

    const nextBal = await h.request('/accounts/balance?scope=personal', { user: USER1 });
    expect(nextBal.status).toBe(200);
    expect(Number(nextBal.json.data.monthlyFixed)).toBe(baseFixed + 2000);

    // 4. Create a weekly expense on credit card (a_card1: statement_day=20, payment_due_day=5)
    // Every Monday = 1, amount = 300
    const createCardWeekly = await h.request('/recurring', {
      method: 'POST',
      user: USER1,
      body: {
        name: '每週買菜刷卡',
        type: 'expense',
        amount: 300,
        cycle: 'weekly',
        day_of_cycle: 1, // 週一
        account_id: 'a_card1',
        is_shared: 0,
      },
    });
    expect(createCardWeekly.status).toBe(201);
    const cardWeekly = createCardWeekly.json.data;

    // 5. Check 365-day forecast
    const fcRes = await h.request('/forecast?scope=personal', { user: USER1 });
    expect(fcRes.status).toBe(200);
    const events = fcRes.json.data.events as Array<{
      event_key: string;
      date: string;
      name: string;
      amount: number;
      is_settled?: boolean;
    }>;

    // Bank weekly item occurs on every Wednesday in 365 days (52 or 53 occurrences)
    const bankWeeklyEvents = events.filter(e => e.event_key.startsWith(`recurring:${bankWeekly.id}:`));
    expect(bankWeeklyEvents.length).toBeGreaterThanOrEqual(52);
    expect(bankWeeklyEvents.length).toBeLessThanOrEqual(53);
    // 2026-06-15 is Monday, so first Wednesday is 2026-06-17
    expect(bankWeeklyEvents[0].date).toBe('2026-06-17');
    expect(bankWeeklyEvents[0].event_key).toBe(`recurring:${bankWeekly.id}:2026-06-17`);

    // Credit card weekly item: multiple Monday charges in the same statement cycle shift to the same due date,
    // and each has a distinct 4-part event_key: recurring:<id>:<dueDate>:<chargeDate>
    const cardWeeklyEvents = events.filter(e => e.event_key.startsWith(`recurring:${cardWeekly.id}:`));
    expect(cardWeeklyEvents.length).toBeGreaterThanOrEqual(45);
    const uniqueCardKeys = new Set(cardWeeklyEvents.map(e => e.event_key));
    expect(uniqueCardKeys.size).toBe(cardWeeklyEvents.length);
    // First charge is 2026-06-15 (Monday, a_card1 statement_day=10, payment_due_day=25 -> >10 so due date is 2026-07-25)
    const firstCardEv = cardWeeklyEvents.find(e => e.event_key.endsWith(':2026-06-15'));
    expect(firstCardEv).toBeDefined();
    expect(firstCardEv?.date).toBe('2026-07-25');
    expect(firstCardEv?.name).toContain('06/15 刷');
    expect(firstCardEv?.name).toContain('信用卡繳款日扣款');

    // 6. Settling a single credit card weekly occurrence only settles that occurrence
    const settleRes = await h.request('/forecast/settle', {
      method: 'POST',
      user: USER1,
      body: { event_key: firstCardEv!.event_key, settled: true },
    });
    expect(settleRes.status).toBe(200);

    const fcAfterSettle = await h.request('/forecast?scope=personal', { user: USER1 });
    const afterEvents = fcAfterSettle.json.data.events as typeof events;
    const settledEv = afterEvents.find(e => e.event_key === firstCardEv!.event_key);
    expect(settledEv?.is_settled).toBe(true);

    // 7. CSV Export includes '每週' and '每週三' / '每週一'
    const csvRes = await h.request('/export/recurring', { user: USER1 });
    expect(csvRes.status).toBe(200);
    const csvText = String(csvRes.json);
    expect(csvText).toContain('"每週教練課",支出,500,每週,每週三');
    expect(csvText).toContain('"每週買菜刷卡",支出,300,每週,每週一');

    // 8. Clean up
    await h.request(`/recurring/${bankWeekly.id}`, { method: 'DELETE', user: USER1 });
    await h.request(`/recurring/${cardWeekly.id}`, { method: 'DELETE', user: USER1 });
  });

  it('#244 & #247: supports dual-track settled recurring deduction, reserve sub-accounts, shortfall catch-up amortization across remaining months before due date, and disposable cash reserve isolation', async () => {
    // 1. Check baseline personal amortize & balance for USER1 (2026-06-15)
    // Personal recurring items in seed for USER1:
    // - r_salary1: income, 60000, monthly
    // - r_bonus: income, 30000, semiannual (month 6)
    // - r_netflix: expense, 390, monthly
    // Let's also create an annual personal expense for USER1 (amount: 36000, month_of_cycle: 8 -> monthly_share = 3000)
    // In 2026-06, target month is 8, cycleMonths = 12, window is 2025-09..2026-08:
    // - accumulated_months (through 2026-06) = 10 -> accumulated_sinking_fund = 30000
    // - prior_accumulated_months (through 2026-05) = 9 -> prior_expected_sinking_fund = 27000
    // - remaining_months_to_due (June, July, August) = 3 months
    // When no reserve sub-account exists yet (actual_reserve_balance = 0):
    // - shortfall_amount = 27000 - 0 = 27000
    // - catchup_monthly_add = 27000 / 3 = 9000
    // - effective_monthly_share = 3000 + 9000 = 12000 (so 12000 * 3 months = 36000 ready by August!)
    const createAnnualRes = await h.request('/recurring', {
      method: 'POST',
      user: USER1,
      body: {
        name: '個人年繳保險',
        type: 'expense',
        amount: 36000,
        cycle: 'annual',
        day_of_cycle: 31,
        month_of_cycle: 8,
        account_id: 'a_card1',
        is_shared: 0,
      },
    });
    expect(createAnnualRes.status).toBe(201);
    const annualItem = createAnnualRes.json.data;

    const baseAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(baseAmort.status).toBe(200);
    expect(baseAmort.json.data.monthly_expense).toBe(3390);
    expect(baseAmort.json.data.settled_monthly_expense).toBe(0);
    expect(baseAmort.json.data.base_remaining_monthly_expense).toBe(3390);
    expect(baseAmort.json.data.prior_expected_sinking_fund).toBe(27000);
    expect(baseAmort.json.data.actual_reserve_balance).toBe(0);
    expect(baseAmort.json.data.reserve_shortfall).toBe(27000);
    expect(baseAmort.json.data.catchup_monthly_add).toBe(9000);
    expect(baseAmort.json.data.remaining_monthly_expense).toBe(3390 + 9000);
    expect(baseAmort.json.data.accumulated_sinking_fund).toBe(30000);
    expect(baseAmort.json.data.annual_total_expense).toBe(390 * 12 + 36000);

    // 2. Create a Reserve Sub-Account under a_bank1 (薪轉戶) with initial balance 0, then transfer 18,000 from a_bank1 into the reserve sub-account
    const createReserveAcc = await h.request('/accounts', {
      method: 'POST',
      user: USER1,
      body: {
        name: '薪轉戶 - 週期預留金子帳戶',
        type: 'bank',
        balance: 0,
        is_reserve: 1,
        parent_account_id: 'a_bank1',
        is_joint: 0,
      },
    });
    expect(createReserveAcc.status).toBe(201);
    const reserveAcc = createReserveAcc.json.data;
    expect(reserveAcc.is_reserve).toBe(1);
    expect(reserveAcc.parent_account_id).toBe('a_bank1');

    // Transfer 18,000 from main bank account (a_bank1) to reserve sub-account
    const transferRes = await h.request('/accounts/transfer', {
      method: 'POST',
      user: USER1,
      body: {
        from_account_id: 'a_bank1',
        to_account_id: reserveAcc.id,
        amount: 18000,
        date: '2026-06-15',
        note: '撥入週期預留金',
      },
    });
    expect(transferRes.status).toBe(200);

    // Now actual_reserve_balance = 18000 vs prior_expected_sinking_fund = 27000:
    // - reserve_shortfall = 27000 - 18000 = 9000
    // - spread across remaining 3 months (June, July, August) -> catchup_monthly_add = 9000 / 3 = 3000
    // - effective_monthly_share for annualItem = 3000 + 3000 = 6000 (18000 + 6000 * 3 = 36000!)
    // - total remaining_monthly_expense = 390 (Netflix) + 6000 = 6390
    const afterReserveAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(afterReserveAmort.status).toBe(200);
    expect(afterReserveAmort.json.data.actual_reserve_balance).toBe(18000);
    expect(afterReserveAmort.json.data.reserve_shortfall).toBe(9000);
    expect(afterReserveAmort.json.data.catchup_monthly_add).toBe(3000);
    expect(afterReserveAmort.json.data.remaining_monthly_expense).toBe(6390);

    const baseBal = await h.request('/accounts/balance?scope=personal', { user: USER1 });
    expect(baseBal.status).toBe(200);
    const baseAvailable = Number(baseBal.json.data.available);
    const baseDisposable = Number(baseBal.json.data.disposable);
    expect(baseBal.json.data.reserveBankTotal).toBe(18000);
    expect(baseBal.json.data.monthlyFixed).toBe(3390);
    expect(baseBal.json.data.catchupMonthlyAdd).toBe(3000);
    expect(baseBal.json.data.remainingMonthlyFixed).toBe(6390);

    // 3. Track 1: Auto-match via transaction note ('Netflix 6月扣款') on bank account
    const txRes = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        type: 'expense',
        amount: 390,
        category: '娛樂',
        note: 'Netflix 6月扣款',
        date: '2026-06-15',
        account_id: 'a_bank1',
        is_shared: 0,
      },
    });
    expect(txRes.status).toBe(201);
    const txId = txRes.json.data.id;

    // Now Netflix (390) is auto-settled via transaction:
    // - available cash decreased by 390 (since it was paid from a_bank1)
    // - remainingMonthlyFixed also decreased by 390 (from 6390 to 6000)
    // - Since available dropped by 390 AND remainingMonthlyFixed dropped by 390, disposable is NOT double-deducted!
    const afterTxAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(afterTxAmort.status).toBe(200);
    expect(afterTxAmort.json.data.settled_monthly_expense).toBe(390);
    expect(afterTxAmort.json.data.remaining_monthly_expense).toBe(6000);
    const netflixItem = afterTxAmort.json.data.items.find((b: { id: string }) => b.id === 'r_netflix');
    expect(netflixItem.is_settled_current_cycle).toBe(true);
    expect(netflixItem.settled_source).toBe('transaction');

    const afterTxBal = await h.request('/accounts/balance?scope=personal', { user: USER1 });
    expect(afterTxBal.json.data.available).toBe(baseAvailable - 390);
    expect(afterTxBal.json.data.settledMonthlyFixed).toBe(390);
    expect(afterTxBal.json.data.remainingMonthlyFixed).toBe(6000);
    // Disposable cash stays equal to baseDisposable (not reduced twice by both available -390 and monthlyFixed -390!)
    expect(afterTxBal.json.data.disposable).toBe(baseDisposable);

    // Clean up the test transaction
    await h.request(`/transactions/${txId}`, { method: 'DELETE', user: USER1 });

    // 4. Track 2: Manual settle toggle via POST /recurring/:id/settle on long-cycle item annualItem (annual 36000, monthly 3000)
    const manualSettle = await h.request(`/recurring/${annualItem.id}/settle`, {
      method: 'POST',
      user: USER1,
      body: { settled: true },
    });
    expect(manualSettle.status).toBe(200);
    expect(manualSettle.json.data.is_settled).toBe(true);

    const afterManualAmort = await h.request('/recurring/amortize?scope=personal', { user: USER1 });
    expect(afterManualAmort.json.data.settled_monthly_expense).toBe(3000);
    expect(afterManualAmort.json.data.catchup_monthly_add).toBe(0);
    expect(afterManualAmort.json.data.remaining_monthly_expense).toBe(390);
    // Once annualItem is settled in current cycle, its accumulated_sinking_fund drops to 0 and annual_settled_expense becomes 36000
    expect(afterManualAmort.json.data.accumulated_sinking_fund).toBe(0);
    expect(afterManualAmort.json.data.annual_settled_expense).toBe(36000);
    expect(afterManualAmort.json.data.annual_remaining_expense).toBe(390 * 12);

    // Transfer 18,000 back to a_bank1, delete reserve sub-account, unsettle and delete annualItem to restore clean state
    await h.request('/accounts/transfer', {
      method: 'POST',
      user: USER1,
      body: {
        from_account_id: reserveAcc.id,
        to_account_id: 'a_bank1',
        amount: 18000,
        date: '2026-06-15',
        note: '測試還原',
      },
    });
    await h.request(`/accounts/${reserveAcc.id}`, { method: 'DELETE', user: USER1 });
    const manualUnsettle = await h.request(`/recurring/${annualItem.id}/settle`, {
      method: 'POST',
      user: USER1,
      body: { settled: false },
    });
    expect(manualUnsettle.status).toBe(200);
    expect(manualUnsettle.json.data.is_settled).toBe(false);
    await h.request(`/recurring/${annualItem.id}`, { method: 'DELETE', user: USER1 });
  });
});
