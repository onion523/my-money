import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
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

// CORS
app.use('*', cors({
  origin: (origin) => {
    // 允許 localhost 開發及所有 Cloudflare Pages 預覽或正式網域
    if (!origin || origin.includes('localhost') || origin.includes('pages.dev') || origin.includes('workers.dev')) {
      return origin || '*';
    }
    return origin;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

export default app;
