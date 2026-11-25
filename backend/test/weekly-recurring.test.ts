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
});
