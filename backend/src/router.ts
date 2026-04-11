import { Env } from './types';
import { authenticate, unauthorizedResponse } from './middleware/auth';
import {
  resolveBookContext,
  noBooksResponse,
  withSwitchHeader,
} from './middleware/book-context';
import { handleRegister, handleLogin, handleMe } from './handlers/auth';
import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
} from './handlers/accounts';
import {
  listFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
} from './handlers/fixed-expenses';
import {
  listSavingsGoals,
  getSavingsGoal,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
} from './handlers/savings-goals';
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './handlers/transactions';
import { handleSync } from './handlers/sync';
import { handleScheduledNotifications } from './handlers/notifications';

/** 從 URL 路徑解析出資源 ID（例如 /api/accounts/abc123 → "abc123"） */
function extractId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix + '/')) return null;
  const id = pathname.slice(prefix.length + 1);
  return id || null;
}

/** 解析 JSON body，若失敗回傳 400 */
async function parseJsonBody<T>(request: Request): Promise<T | Response> {
  try {
    return (await request.json()) as T;
  } catch {
    return Response.json(
      { ok: false, error: '無效的 JSON 格式' },
      { status: 400 }
    );
  }
}

/** 主路由：根據 method + pathname 分派到對應 handler */
export async function handleRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // ── 公開路由（不需驗證） ──
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    return handleRegister(body as any, env);
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    return handleLogin(body as any, env);
  }

  // ── 身份驗證 ──
  const userId = await authenticate(request, env);
  if (!userId) {
    return unauthorizedResponse();
  }

  // ── /api/auth/me — 不需要 book context ──
  if (pathname === '/api/auth/me' && method === 'GET') {
    return handleMe(userId, env);
  }

  // ── /api/notifications/trigger（手動觸發推撥排程，用於測試） ──
  if (pathname === '/api/notifications/trigger' && method === 'POST') {
    await handleScheduledNotifications(env);
    return Response.json({ ok: true, message: '推撥排程已手動觸發' });
  }

  // ── 從這裡開始所有 endpoint 都需要 book context ──
  const ctx = await resolveBookContext(userId, env);
  if (!ctx) {
    return noBooksResponse();
  }

  const wrap = (res: Promise<Response>) => res.then((r) => withSwitchHeader(r, ctx));

  // ── /api/sync ──
  if (pathname === '/api/sync' && method === 'POST') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    return wrap(handleSync(ctx, body as any, env));
  }

  // ── /api/accounts ──
  if (pathname === '/api/accounts') {
    if (method === 'GET') return wrap(listAccounts(ctx, env));
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(createAccount(ctx, body as any, env));
    }
  }
  const accountId = extractId(pathname, '/api/accounts');
  if (accountId) {
    if (method === 'GET') return wrap(getAccount(ctx, accountId, env));
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(updateAccount(ctx, accountId, body as any, env));
    }
    if (method === 'DELETE') return wrap(deleteAccount(ctx, accountId, env));
  }

  // ── /api/fixed-expenses ──
  if (pathname === '/api/fixed-expenses') {
    if (method === 'GET') return wrap(listFixedExpenses(ctx, env));
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(createFixedExpense(ctx, body as any, env));
    }
  }
  const fixedExpenseId = extractId(pathname, '/api/fixed-expenses');
  if (fixedExpenseId) {
    if (method === 'GET') return wrap(getFixedExpense(ctx, fixedExpenseId, env));
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(updateFixedExpense(ctx, fixedExpenseId, body as any, env));
    }
    if (method === 'DELETE') return wrap(deleteFixedExpense(ctx, fixedExpenseId, env));
  }

  // ── /api/savings-goals ──
  if (pathname === '/api/savings-goals') {
    if (method === 'GET') return wrap(listSavingsGoals(ctx, env));
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(createSavingsGoal(ctx, body as any, env));
    }
  }
  const savingsGoalId = extractId(pathname, '/api/savings-goals');
  if (savingsGoalId) {
    if (method === 'GET') return wrap(getSavingsGoal(ctx, savingsGoalId, env));
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(updateSavingsGoal(ctx, savingsGoalId, body as any, env));
    }
    if (method === 'DELETE') return wrap(deleteSavingsGoal(ctx, savingsGoalId, env));
  }

  // ── /api/transactions ──
  if (pathname === '/api/transactions') {
    if (method === 'GET') return wrap(listTransactions(ctx, url, env));
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(createTransaction(ctx, body as any, env));
    }
  }
  const transactionId = extractId(pathname, '/api/transactions');
  if (transactionId) {
    if (method === 'GET') return wrap(getTransaction(ctx, transactionId, env));
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return wrap(updateTransaction(ctx, transactionId, body as any, env));
    }
    if (method === 'DELETE') return wrap(deleteTransaction(ctx, transactionId, env));
  }

  // ── 404 ──
  return Response.json(
    { ok: false, error: '找不到該路由' },
    { status: 404 }
  );
}
