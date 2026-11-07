import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, type Harness } from './harness';

// ADR 0036 / #186 / #187: 收支明細無限捲動分頁載入 — 後端篩選與彙總對齊
describe('ADR 0036: transactions infinite scroll pagination backend alignment', () => {
  let h: Harness;
  const TOTAL = 230;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);

    for (let i = 0; i < TOTAL; i++) {
      const res = await h.request('/transactions', {
        method: 'POST',
        user: USER1,
        body: {
          account_id: 'a_cash1',
          type: i % 2 === 0 ? 'expense' : 'income',
          category: i % 3 === 0 ? '餐飲' : '日用品',
          amount: 10 + (i % 7),
          note: `scroll-${i}`,
          date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`,
          is_shared: 0,
        },
      });
      expect(res.status).toBe(201);
    }
  }, 120_000);

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  async function walk(query: string, pageSize = 50) {
    const rows: any[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
      const res = await h.request(`/transactions?${query}&limit=${pageSize}${cursor ? `&cursor=${cursor}` : ''}`, { user: USER1 });
      expect(res.status).toBe(200);
      rows.push(...res.json.data);
      cursor = res.json.next_cursor;
      if (!cursor) break;
    }
    return rows;
  }

  it('walks past 200 rows with cursor pages: no duplicates, no omissions, count equals summary/range', async () => {
    const q = 'scope=personal&from=2027-01-01&to=2027-01-31';
    const rows = await walk(q);
    expect(rows.length).toBe(TOTAL);
    expect(new Set(rows.map(r => r.id)).size).toBe(TOTAL);

    const sum = await h.request(`/transactions/summary/range?${q}`, { user: USER1 });
    expect(sum.json.data.count).toBe(TOTAL);
  });

  it('category + type + q filters are applied server-side and totals match the filtered list', async () => {
    const q = `scope=personal&from=2027-01-01&to=2027-01-31&category=${encodeURIComponent('餐飲')}&type=expense&q=SCROLL`;
    const rows = await walk(q, 20);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.category === '餐飲' && r.type === 'expense')).toBe(true);

    const sum = await h.request(`/transactions/summary/range?${q}`, { user: USER1 });
    const expected = Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    expect(sum.json.data.count).toBe(rows.length);
    expect(sum.json.data.total_expense).toBe(expected);
    expect(sum.json.data.total_income).toBe(0);
  });
});
