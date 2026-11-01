import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, type Harness } from './harness';
import { CASES } from './cases';

/**
 * API 基準測試（ADR 0034，唯一 seam：HTTP API 層）。
 * 以固定時間與確定性資料集記錄各端點回應快照，優化前後必須一致。
 * 耗時量測見 bench.test.ts（BENCH=1）。
 */
describe('API baseline (snapshot)', () => {
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

  for (const c of CASES) {
    it(c.name, async () => {
      const res = await h.request(c.path, { method: c.method, body: c.body, user: c.user });
      expect(res.status).toBe(200);
      expect(res.json).toMatchSnapshot();
    });
  }

  it('transactions cursor pagination matches offset pagination', async () => {
    const collect = async (useCursor: boolean) => {
      const ids: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 40; page++) {
        const q: string = useCursor
          ? `/transactions?limit=25${cursor ? `&cursor=${cursor}` : ''}`
          : `/transactions?limit=25&offset=${page * 25}`;
        const res = await h.request(q);
        const rows = res.json.data as Array<{ id: string }>;
        ids.push(...rows.map(r => r.id));
        if (rows.length < 25) break;
        cursor = res.json.next_cursor;
        if (useCursor && !cursor) break;
      }
      return ids;
    };
    const byOffset = await collect(false);
    const byCursor = await collect(true);
    expect(byCursor).toEqual(byOffset);
    expect(new Set(byOffset).size).toBe(byOffset.length);
    expect(byOffset.length).toBeGreaterThan(100);
  });
});
