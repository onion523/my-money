import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, type Harness } from './harness';

/**
 * ADR 0034 / #180：驗證 idx_tx_user_sort 索引已建立、EXPLAIN QUERY PLAN 使用該索引且無暫存排序，
 * 並驗證游標分頁與 offset 分頁在不同篩選條件下結果一致。
 */
describe('transactions sort index and keyset pagination (#180)', () => {
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

  it('creates idx_tx_user_sort and drops duplicate idx_tx_pair', async () => {
    const rows = await h.db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions'"
    ).all<{ name: string }>();
    const names = (rows.results || []).map(r => r.name);
    expect(names).toContain('idx_tx_user_sort');
    expect(names).toContain('idx_tx_pair_id');
    expect(names).not.toContain('idx_tx_pair');
  });

  it('uses idx_tx_user_sort without temp B-tree sort on user-scoped ordered queries (EXPLAIN QUERY PLAN)', async () => {
    const plan = await h.db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT t.*, a.name as account_name, a.is_joint as account_is_joint, a.type as account_type, u.name as user_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ?
      ORDER BY t.date DESC, t.created_at DESC, t.id DESC
      LIMIT 50
    `).bind(USER1).all<{ detail: string }>();
    const details = (plan.results || []).map(r => r.detail).join(' | ');
    expect(details).toContain('idx_tx_user_sort');
    expect(details).not.toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('cursor pagination matches offset pagination across personal and household scopes', async () => {
    for (const scope of ['personal', 'household', 'all']) {
      const collect = async (useCursor: boolean) => {
        const ids: string[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 30; page++) {
          const q = useCursor
            ? `/transactions?scope=${scope}&limit=20${cursor ? `&cursor=${cursor}` : ''}`
            : `/transactions?scope=${scope}&limit=20&offset=${page * 20}`;
          const res = await h.request(q);
          expect(res.status).toBe(200);
          const rows = res.json.data as Array<{ id: string }>;
          ids.push(...rows.map(r => r.id));
          if (rows.length < 20) break;
          cursor = res.json.next_cursor;
          if (useCursor && !cursor) break;
        }
        return ids;
      };
      const byOffset = await collect(false);
      const byCursor = await collect(true);
      expect(byCursor).toEqual(byOffset);
      expect(byOffset.length).toBeGreaterThan(20);
    }
  });
});
