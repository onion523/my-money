import { Env } from './types';
import { authenticate, unauthorizedResponse } from './middleware/auth';
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

  // ── 身份驗證 ──
  const userId = authenticate(request, env);
  if (!userId) {
    return unauthorizedResponse();
  }

  // ── /api/sync ──
  if (pathname === '/api/sync' && method === 'POST') {
    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;
    return handleSync(userId, body as any, env);
  }

  // ── /api/notifications/trigger（手動觸發推撥排程，用於測試） ──
  if (pathname === '/api/notifications/trigger' && method === 'POST') {
    await handleScheduledNotifications(env);
    return Response.json({ ok: true, message: '推撥排程已手動觸發' });
  }

  // ── /api/accounts ──
  if (pathname === '/api/accounts') {
    if (method === 'GET') return listAccounts(userId, env);
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return createAccount(userId, body as any, env);
    }
  }
  const accountId = extractId(pathname, '/api/accounts');
  if (accountId) {
    if (method === 'GET') return getAccount(userId, accountId, env);
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return updateAccount(userId, accountId, body as any, env);
    }
    if (method === 'DELETE') return deleteAccount(userId, accountId, env);
  }

  // ── /api/fixed-expenses ──
  if (pathname === '/api/fixed-expenses') {
    if (method === 'GET') return listFixedExpenses(userId, env);
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return createFixedExpense(userId, body as any, env);
    }
  }
  const fixedExpenseId = extractId(pathname, '/api/fixed-expenses');
  if (fixedExpenseId) {
    if (method === 'GET') return getFixedExpense(userId, fixedExpenseId, env);
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return updateFixedExpense(userId, fixedExpenseId, body as any, env);
    }
    if (method === 'DELETE') return deleteFixedExpense(userId, fixedExpenseId, env);
  }

  // ── /api/savings-goals ──
  if (pathname === '/api/savings-goals') {
    if (method === 'GET') return listSavingsGoals(userId, env);
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return createSavingsGoal(userId, body as any, env);
    }
  }
  const savingsGoalId = extractId(pathname, '/api/savings-goals');
  if (savingsGoalId) {
    if (method === 'GET') return getSavingsGoal(userId, savingsGoalId, env);
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return updateSavingsGoal(userId, savingsGoalId, body as any, env);
    }
    if (method === 'DELETE') return deleteSavingsGoal(userId, savingsGoalId, env);
  }

  // ── /api/transactions ──
  if (pathname === '/api/transactions') {
    if (method === 'GET') return listTransactions(userId, url, env);
    if (method === 'POST') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return createTransaction(userId, body as any, env);
    }
  }
  const transactionId = extractId(pathname, '/api/transactions');
  if (transactionId) {
    if (method === 'GET') return getTransaction(userId, transactionId, env);
    if (method === 'PUT') {
      const body = await parseJsonBody(request);
      if (body instanceof Response) return body;
      return updateTransaction(userId, transactionId, body as any, env);
    }
    if (method === 'DELETE') return deleteTransaction(userId, transactionId, env);
  }

  // ── 404 ──
  return Response.json(
    { ok: false, error: '找不到該路由' },
    { status: 404 }
  );
}
