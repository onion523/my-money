import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, USER1, USER2, type Harness } from './harness';

/** ADR 0034 / #178：已結清事件讀取僅限本人與家庭成員 */
describe('forecast settled events scope', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    // 非家庭成員 u3 的紀錄，key 恰與 u1/u2 家庭的房租事件相同
    await h.db.prepare("INSERT INTO forecast_settled_events (event_key,user_id) VALUES ('recurring:r_rent:2026-07-01','u3')").run();
    // 家人（u2）已結清之事件，u1 應可見
    await h.db.prepare("INSERT INTO forecast_settled_events (event_key,user_id) VALUES ('recurring:r_elec:2026-06-15','u2')").run();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  const settledMap = async (user: string, path = '/forecast?scope=household') => {
    const res = await h.request(path, { user });
    expect(res.status).toBe(200);
    const m = new Map<string, boolean>();
    for (const e of res.json.data.events as Array<{ event_key: string; is_settled: boolean }>) m.set(e.event_key, e.is_settled);
    return m;
  };

  it('ignores settled rows written by users outside the household', async () => {
    const m = await settledMap(USER1);
    expect(m.has('recurring:r_rent:2026-07-01')).toBe(true);
    expect(m.get('recurring:r_rent:2026-07-01')).toBe(false);
  });

  it('still honours settled rows written by household members', async () => {
    const m = await settledMap(USER1);
    expect(m.get('recurring:r_elec:2026-06-15')).toBe(true);
    const m2 = await settledMap(USER2);
    expect(m2.get('recurring:r_elec:2026-06-15')).toBe(true);
  });

  it('purchase-check is not affected by outsiders settled rows', async () => {
    const withOutsider = await h.request('/forecast/purchase-check', { method: 'POST', body: { amount: 1000, scope: 'household' } });
    await h.db.prepare("DELETE FROM forecast_settled_events WHERE user_id = 'u3'").run();
    const without = await h.request('/forecast/purchase-check', { method: 'POST', body: { amount: 1000, scope: 'household' } });
    expect(withOutsider.json).toEqual(without.json);
  });
});
