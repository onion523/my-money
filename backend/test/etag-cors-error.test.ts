import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { createHarness, FIXED_NOW, USER1, type Harness } from './harness';

const PROD_ORIGIN = 'https://my-money-onion.pages.dev';

/**
 * ADR 0034 / #182 / #183：
 * 1. 跨網域 304 Not Modified 回應必須保留 Access-Control-Allow-Origin 與 Access-Control-Expose-Headers，
 *    避免瀏覽器於第二次 GET 請求時因 CORS 失敗拋出 TypeError: Failed to fetch。
 * 2. 未捕捉例外由全域 app.onError 回傳具備 CORS 標頭之標準 500 JSON。
 */
describe('Cross-origin 304 ETag CORS retention and global onError (#183)', () => {
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

  it('retains Access-Control-Allow-Origin and Access-Control-Expose-Headers on 304 Not Modified', async () => {
    const first = await h.request('/accounts', {
      headers: { Origin: PROD_ORIGIN },
    });
    expect(first.status).toBe(200);
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();
    expect(first.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    expect(first.headers.get('Access-Control-Expose-Headers')).toContain('ETag');

    const second = await h.request('/accounts', {
      headers: {
        Origin: PROD_ORIGIN,
        'If-None-Match': etag!,
      },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('ETag')).toBe(etag);
    expect(second.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    expect(second.headers.get('Access-Control-Expose-Headers')).toContain('ETag');
  });

  it('returns structured 500 JSON with CORS headers when an unhandled error occurs', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const brokenEnv = {
        DB: {
          prepare() {
            throw new Error('simulated D1 failure');
          },
        } as unknown as D1Database,
      };
      const res = await app.fetch(
        new Request('http://localhost/goals', {
          method: 'GET',
          headers: {
            Origin: PROD_ORIGIN,
            Authorization: `Bearer ${h.tokens[USER1]}`,
          },
        }),
        brokenEnv
      );
      expect(res.status).toBe(500);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
      const body = await res.json();
      expect(body).toEqual({
        success: false,
        error: '伺服器內部錯誤，請稍後再試',
      });
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });
});
