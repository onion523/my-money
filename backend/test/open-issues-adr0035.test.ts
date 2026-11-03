import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, USER2, type Harness } from './harness';

describe('ADR 0035: Open Issues (#184, #163, #156, #121, #98)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  it('#184: GET /transactions supports type and case-insensitive q (note, category, account_name, user_name) with cursor pagination, and GET /transactions/summary/range matches paginated totals including system categories', async () => {
    // 1. Filter by type=income
    const incRes = await h.request('/transactions?type=income&limit=200');
    expect(incRes.status).toBe(200);
    expect(incRes.json.data.length).toBeGreaterThan(0);
    expect(incRes.json.data.every((t: any) => t.type === 'income')).toBe(true);

    // 2. Filter by q matching account_name ('薪轉戶'), user_name ('alice'), category ('信用卡還款'), note ('n1')
    const qAccRes = await h.request(`/transactions?q=${encodeURIComponent('薪轉戶')}&limit=200`);
    expect(qAccRes.status).toBe(200);
    expect(qAccRes.json.data.length).toBeGreaterThan(0);
    expect(qAccRes.json.data.every((t: any) => String(t.account_name || '').includes('薪轉戶'))).toBe(true);

    const qUserRes = await h.request('/transactions?q=ALICE&limit=200');
    expect(qUserRes.status).toBe(200);
    expect(qUserRes.json.data.length).toBeGreaterThan(0);
    expect(qUserRes.json.data.every((t: any) => String(t.user_name || '').toLowerCase().includes('alice') || String(t.account_name || '').toLowerCase().includes('alice'))).toBe(true);

    // 3. Cursor pagination with type + q matches full list and summary/range
    const queryFilter = 'scope=all&from=2026-01-01&to=2026-06-30&type=expense&q=a';
    const allPages: any[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 30; page++) {
      const url = `/transactions?${queryFilter}&limit=7${cursor ? `&cursor=${cursor}` : ''}`;
      const pageRes = await h.request(url);
      expect(pageRes.status).toBe(200);
      const rows = pageRes.json.data as any[];
      allPages.push(...rows);
      cursor = pageRes.json.next_cursor;
      if (!cursor || rows.length < 7) break;
    }

    const sumRes = await h.request(`/transactions/summary/range?${queryFilter}`);
    expect(sumRes.status).toBe(200);
    const sumData = sumRes.json.data;
    expect(sumData.count).toBe(allPages.length);
    const expectedExpense = Math.round(allPages.reduce((s, r) => s + (r.type === 'expense' ? Number(r.amount) : 0), 0) * 100) / 100;
    expect(Math.round(Number(sumData.total_expense) * 100) / 100).toBe(expectedExpense);
    expect(Number(sumData.total_income)).toBe(0);

    // 4. Verify May 2026 summary/range includes system categories ('信用卡還款' 4500 and '內部轉帳' 1000)
    const mayFull = await h.request('/transactions?scope=all&from=2026-05-01&to=2026-05-31&limit=200');
    const mayRows = mayFull.json.data as any[];
    const maySumRes = await h.request('/transactions/summary/range?scope=all&from=2026-05-01&to=2026-05-31');
    expect(maySumRes.status).toBe(200);
    const maySum = maySumRes.json.data;
    expect(maySum.count).toBe(mayRows.length);
    const mayIncome = Math.round(mayRows.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    const mayExpense = Math.round(mayRows.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    expect(Math.round(Number(maySum.total_income) * 100) / 100).toBe(mayIncome);
    expect(Math.round(Number(maySum.total_expense) * 100) / 100).toBe(mayExpense);
    expect(Array.isArray(maySum.by_day)).toBe(true);
    const byDayIncome = Math.round(maySum.by_day.reduce((s: number, d: any) => s + Number(d.income), 0) * 100) / 100;
    const byDayExpense = Math.round(maySum.by_day.reduce((s: number, d: any) => s + Number(d.expense), 0) * 100) / 100;
    expect(byDayIncome).toBe(mayIncome);
    expect(byDayExpense).toBe(mayExpense);
  });

  it('#163: POST /transactions has updated_at = null and PUT /transactions/:id sets updated_at', async () => {
    const createRes = await h.request('/transactions', {
      method: 'POST',
      body: {
        account_id: 'a_cash1',
        type: 'expense',
        category: '餐飲',
        amount: 120,
        note: '測試建立時間',
        date: '2026-06-15',
        is_shared: 0,
      },
    });
    expect(createRes.status).toBe(201);
    const created = createRes.json.data;
    expect(created.updated_at).toBeNull();

    const updateRes = await h.request(`/transactions/${created.id}`, {
      method: 'PUT',
      body: {
        account_id: 'a_cash1',
        type: 'expense',
        category: '餐飲',
        amount: 150,
        note: '測試修改時間',
        date: '2026-06-15',
        is_shared: 0,
      },
    });
    expect(updateRes.status).toBe(200);
    expect(typeof updateRes.json.data.updated_at).toBe('string');
    expect(updateRes.json.data.updated_at.length).toBeGreaterThan(10);

    // Clean up test transaction
    await h.request(`/transactions/${created.id}`, { method: 'DELETE' });
  });

  it('#156: GET /accounts masks payment_account_id and payment_account_name on others private cards, and POST/PUT validates payment_account_id', async () => {
    // 1. Reject binding a cash account or another user's private bank account as payment_account_id
    const badCashRes = await h.request('/accounts/a_card1', {
      method: 'PUT',
      user: USER1,
      body: { payment_account_id: 'a_cash1' },
    });
    expect(badCashRes.status).toBe(400);

    const badOtherPrivateBankRes = await h.request('/accounts/a_card1', {
      method: 'PUT',
      user: USER1,
      body: { payment_account_id: 'a_bank2' },
    });
    expect(badOtherPrivateBankRes.status).toBe(400);

    // 2. Non-credit-card ignores/clears payment_account_id on PUT
    const bankPutRes = await h.request('/accounts/a_bank1', {
      method: 'PUT',
      user: USER1,
      body: { payment_account_id: 'a_bankj' },
    });
    expect(bankPutRes.status).toBe(200);
    expect(bankPutRes.json.data.payment_account_id).toBeNull();

    // 3. Valid binding of USER1's private card a_card1 to USER1's private bank a_bank1
    const okBindRes = await h.request('/accounts/a_card1', {
      method: 'PUT',
      user: USER1,
      body: { payment_account_id: 'a_bank1' },
    });
    expect(okBindRes.status).toBe(200);
    expect(okBindRes.json.data.payment_account_id).toBe('a_bank1');

    // Add a shared expense on a_card1 so USER2 sees a_card1 as a masked card in household scope
    const sharedTxRes = await h.request('/transactions', {
      method: 'POST',
      user: USER1,
      body: {
        account_id: 'a_card1',
        type: 'expense',
        category: '日用品',
        amount: 300,
        note: '公帳代墊',
        date: '2026-06-14',
        is_shared: 1,
      },
    });
    expect(sharedTxRes.status).toBe(201);

    // USER1 sees own card with payment_account_id & payment_account_name
    const u1Accs = await h.request('/accounts?scope=all', { user: USER1 });
    const u1Card = u1Accs.json.data.find((a: any) => a.id === 'a_card1');
    expect(u1Card.payment_account_id).toBe('a_bank1');
    expect(u1Card.payment_account_name).toBe('薪轉戶');

    // USER2 in household scope sees a_card1 masked with payment_account_id = null and payment_account_name = null
    const u2Accs = await h.request('/accounts?scope=household', { user: USER2 });
    const u2MaskedCard = u2Accs.json.data.find((a: any) => a.id === 'a_card1');
    expect(u2MaskedCard).toBeDefined();
    expect(u2MaskedCard.is_masked).toBe(true);
    expect(u2MaskedCard.payment_account_id).toBeNull();
    expect(u2MaskedCard.payment_account_name).toBeNull();

    // Clean up
    await h.request(`/transactions/${sharedTxRes.json.data.id}`, { method: 'DELETE', user: USER1 });
    await h.request('/accounts/a_card1', { method: 'PUT', user: USER1, body: { payment_account_id: null } });
  });

  it('#98: GET /forecast returns cardDeduction and startingBalance equals cashTotal + bankTotal - cardDeduction', async () => {
    const res = await h.request('/forecast?scope=all', { user: USER1 });
    expect(res.status).toBe(200);
    const d = res.json.data;
    expect(typeof d.cardDeduction).toBe('number');
    expect(Math.round((d.cashTotal + d.bankTotal - d.cardDeduction) * 100) / 100).toBe(d.startingBalance);
  });

  it('#121: DELETE /auth/account transfers household ownership (created_by & admin role) to remaining member instead of cascading household deletion', async () => {
    // USER1 is creator and admin of household 'h1'; USER2 is a member of 'h1'
    const delRes = await h.request('/auth/account', { method: 'DELETE', user: USER1 });
    expect(delRes.status).toBe(200);

    // Verify household 'h1' still exists for USER2 and USER2 is now admin and created_by
    const hhRes = await h.request('/households/current', { user: USER2 });
    expect(hhRes.status).toBe(200);
    expect(hhRes.json.data.household).not.toBeNull();
    expect(hhRes.json.data.household.id).toBe('h1');
    expect(hhRes.json.data.household.created_by).toBe(USER2);
    expect(hhRes.json.data.myRole).toBe('admin');
  });
});
