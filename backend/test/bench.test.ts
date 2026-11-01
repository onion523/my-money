import { describe, expect, it } from 'vitest';
import { createHarness } from './harness';
import { CASES } from './cases';

/**
 * 端點耗時量測（僅 BENCH=1 時執行）。
 * 注意：須獨立成檔，因 ensureAccountsSchema 以模組層旗標防重複遷移，
 * 每個測試檔（獨立模組環境）只能建立一個 Harness。
 *
 * 用法（PowerShell）：$env:BENCH='1'; $env:BENCH_ROWS='6000'; vitest run test/bench.test.ts
 */
describe.skipIf(!process.env.BENCH)('API timing benchmark', () => {
  it('reports median latency per endpoint on a large dataset', async () => {
    const bulk = Number(process.env.BENCH_ROWS || 6000);
    const h = await createHarness({ bulk });

    const rows: Array<{ endpoint: string; median_ms: number; max_ms: number }> = [];
    for (const c of CASES) {
      await h.request(c.path, { method: c.method, body: c.body, user: c.user }); // warm
      const times: number[] = [];
      for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        await h.request(c.path, { method: c.method, body: c.body, user: c.user });
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      rows.push({ endpoint: c.name, median_ms: Math.round(times[3] * 10) / 10, max_ms: Math.round(times[6] * 10) / 10 });
    }
    console.log(`\n=== BENCH rows(bulk)=${bulk} ===`);
    console.table(rows);
    await h.dispose();
    expect(rows.length).toBe(CASES.length);
  }, 600_000);
});
