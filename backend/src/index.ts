import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { etag, RETAINED_304_HEADERS } from 'hono/etag';
import type { Env } from './types';
import auth from './handlers/auth';
import accounts from './handlers/accounts';
import transactions from './handlers/transactions';
import recurring from './handlers/recurring';
import goals from './handlers/goals';
import budgets from './handlers/budgets';
import forecast from './handlers/forecast';
import exportRouter from './handlers/export';
import households from './handlers/households';
import bot from './handlers/bot';

const app = new Hono<{ Bindings: Env }>();

function resolveAllowOrigin(origin?: string | null): string {
  return origin || '*';
}

// CORS
app.use('*', cors({
  origin: (origin) => resolveAllowOrigin(origin),
  allowHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
  exposeHeaders: ['ETag'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// HTTP ETag (304 Not Modified 條件式快取，ADR-0033 / ADR-0034：保留跨網域 CORS 標頭避免瀏覽器阻擋 304)
app.use('*', etag({
  retainedHeaders: [
    ...RETAINED_304_HEADERS,
    'access-control-allow-origin',
    'access-control-expose-headers',
    'access-control-allow-credentials',
  ],
}));

// Health check
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// Routes
app.route('/auth', auth);
app.route('/accounts', accounts);
app.route('/transactions', transactions);
app.route('/recurring', recurring);
app.route('/goals', goals);
app.route('/budgets', budgets);
app.route('/forecast', forecast);
app.route('/export', exportRouter);
app.route('/households', households);
app.route('/bot', bot);

// 404
app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404));

// 全域錯誤防線 (ADR-0034：記錄結構化錯誤日誌並統一回傳含 CORS 標頭之 500 JSON)
app.onError((err, c) => {
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err);
  const origin = c.req.header('Origin');
  c.header('Access-Control-Allow-Origin', resolveAllowOrigin(origin));
  c.header('Access-Control-Expose-Headers', 'ETag');
  return c.json({ success: false, error: '伺服器內部錯誤，請稍後再試' }, 500);
});

export default app;
