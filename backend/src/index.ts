import { Env } from './types';
import { handleRequest } from './router';

/**
 * Cloudflare Workers 入口
 * 處理 CORS 預檢請求，再將實際請求轉交給路由器
 */
export default {
  /** Cron Trigger 入口：排程推撥通知 */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const { handleScheduledNotifications } = await import(
      './handlers/notifications'
    );
    await handleScheduledNotifications(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // ── CORS 預檢 ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const response = await handleRequest(request, env);
      // 為所有回應加上 CORS header
      return addCorsHeaders(response);
    } catch (err) {
      // 全域錯誤處理：避免 Worker 直接崩潰
      console.error('未預期的錯誤：', err);
      return addCorsHeaders(
        Response.json(
          { ok: false, error: '伺服器內部錯誤' },
          { status: 500 }
        )
      );
    }
  },
} satisfies ExportedHandler<Env>;

/** 產生 CORS 標頭 */
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/** 將 CORS header 附加到既有回應上 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
