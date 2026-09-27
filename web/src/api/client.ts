// API ?澆撅??????fetch 隢??絞銝?亙
const BASE = (import.meta as any).env?.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('mm_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '隢?憭望?');
  return data.data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

// Auth
export const authApi = {
  login: (body: { email: string; password: string }) =>
    post<{ token: string; user: { id: string; email: string; name: string } }>('/auth/login', body),
  register: (body: { email: string; password: string; name: string }) =>
    post<{ token: string; user: { id: string; email: string; name: string } }>('/auth/register', body),
};

// Accounts
export const accountsApi = {
  list: () => get<Account[]>('/accounts'),
  balance: () => get<BalanceSummary>('/accounts/balance'),
  create: (body: Partial<Account>) => post<Account>('/accounts', body),
  update: (id: string, body: Partial<Account>) => put<Account>(`/accounts/${id}`, body),
  remove: (id: string) => del<null>(`/accounts/${id}`),
};

// Transactions
export const txApi = {
  list: (params?: Record<string, string>) =>
    get<Transaction[]>(`/transactions${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  summary: (month?: string, scope?: string) => {
    const q = new URLSearchParams();
    if (month) q.set('month', month);
    if (scope) q.set('scope', scope);
    const qs = q.toString();
    return get<CategorySummary[]>(`/transactions/summary/category${qs ? '?' + qs : ''}`);
  },
  monthly: (year?: string, scope?: string) => {
    const q = new URLSearchParams();
    if (year) q.set('year', year);
    if (scope) q.set('scope', scope);
    const qs = q.toString();
    return get<MonthlyStats[]>(`/transactions/summary/monthly${qs ? '?' + qs : ''}`);
  },
  householdShares: (month?: string) =>
    get<Array<{ user_id: string; user_name: string; total: number }>>(
      `/transactions/summary/household-shares${month ? '?month=' + month : ''}`
    ),
  categorySummary: (month?: string, scope?: string) =>
    txApi.summary(month, scope),
  monthlyStats: (year?: string, scope?: string) =>
    txApi.monthly(year, scope),
  create: (body: Partial<Transaction> & { is_shared?: number }) => post<Transaction>('/transactions', body),
  update: (id: string, body: Partial<Transaction> & { is_shared?: number }) => put<Transaction>(`/transactions/${id}`, body),
  remove: (id: string) => del<null>(`/transactions/${id}`),
};

// Recurring
export const recurringApi = {
  list: () => get<RecurringItem[]>('/recurring'),
  amortize: () => get<AmortizeResult>('/recurring/amortize'),
  create: (body: Partial<RecurringItem>) => post<RecurringItem>('/recurring', body),
  update: (id: string, body: Partial<RecurringItem>) => put<RecurringItem>(`/recurring/${id}`, body),
  remove: (id: string) => del<null>(`/recurring/${id}`),
};

// Goals
export const goalsApi = {
  list: () => get<Goal[]>('/goals'),
  create: (body: Partial<Goal>) => post<Goal>('/goals', body),
  update: (id: string, body: Partial<Goal>) => put<Goal>(`/goals/${id}`, body),
  remove: (id: string) => del<null>(`/goals/${id}`),
  deposit: (id: string, amount: number) => post<Goal>(`/goals/${id}/deposit`, { amount }),
};

// Budgets
export const budgetsApi = {
  list: (month?: string) => get<BudgetWithSpent[]>(`/budgets${month ? '?month=' + month : ''}`),
  set: (body: { category: string; amount: number; month: string }) => put<Budget>('/budgets', body),
  upsert: (body: { category: string; amount: number; month: string }) => put<Budget>('/budgets', body),
};

// Forecast & Purchase check
export const forecastApi = {
  get: () => get<ForecastResult>('/forecast'),
  purchaseCheck: (amount: number) => post<PurchaseCheckResult>('/forecast/purchase-check', { amount }),
};

// Export
export const exportApi = {
  csv: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const token = getToken();
    if (token) params.set('token', token);
    window.open(`${BASE}/export/csv?${params.toString()}`, '_blank');
  },
  recurringCsv: () => {
    const params = new URLSearchParams();
    const token = getToken();
    if (token) params.set('token', token);
    window.open(`${BASE}/export/recurring?${params.toString()}`, '_blank');
  },
};

// Household (摰嗅滬??)
export const householdApi = {
  current: () => get<HouseholdData>('/households/current'),
  create: (name: string) => post<{ id: string; name: string; role: string }>('/households', { name }),
  invite: () => post<{ code: string; expires_at: string }>('/households/invite'),
  join: (code: string) => post<{ household: Household; role: string }>('/households/join', { code }),
  leave: () => del<{ message: string }>('/households/leave'),
  removeMember: (userId: string) => del<{ message: string }>(`/households/members/${userId}`),
};

// Bot (LINE & Telegram 璈鈭?
export const botApi = {
  pairingCode: () => post<{ code: string; expires_in_seconds: number; expires_at: string }>('/bot/pairing-code'),
  bindings: () => get<BotBinding[]>('/bot/bindings'),
  unbind: (id: string) => del<{ message: string }>(`/bot/bindings/${id}`),
  testSimulate: (text: string, platform: 'line' | 'telegram' = 'line') =>
    post<{ input: string; reply: string }>('/bot/test-simulate', { text, platform }),
};

// Types
export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'credit_card';
  balance: number;
  credit_limit?: number | null;
  statement_day?: number | null;
  payment_due_day?: number | null;
  unbilled: number;
  color: string;
  created_at: string;
  owner_name?: string;
}

export interface BalanceSummary {
  bankTotal: number;
  ccBilled: number;
  ccUnbilled: number;
  available: number;
  monthlyFixed: number;
  monthlyGoals: number;
  disposable: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  note: string;
  date: string;
  is_shared?: number;
  created_at: string;
  account_name?: string;
  user_name?: string;
}

export interface CategorySummary {
  category: string;
  total: number;
}

export interface MonthlyStats {
  month: string;
  type: 'income' | 'expense';
  total: number;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  account_id?: string | null;
  account_name?: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  cycle: 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual';
  day_of_cycle: number;
  created_at: string;
}

export interface AmortizeResult {
  monthly_expense: number;
  monthly_income: number;
  items: RecurringItem[];
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number;
  saved_amount: number;
  monthly_reserve: number;
  deadline?: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
}

export interface BudgetWithSpent extends Budget {
  spent: number;
  over: boolean;
}

export interface ForecastResult {
  dailyBalances: Array<{ date: string; balance: number; events: DayEvent[] }>;
  minBalance: number;
  minDate: string;
  willOverdraft: boolean;
  events: DayEvent[];
}

export interface DayEvent {
  date: string;
  name: string;
  type: string;
  amount: number;
}

export interface PurchaseCheckResult {
  amount: number;
  verdict: 'safe' | 'caution' | 'danger';
  willOverdraft: boolean;
  affectsSavings: boolean;
  affectedGoals: Array<{ name: string; saved_amount: number; target_amount: number; monthly_reserve: number }>;
  minBalance: number;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  name: string;
  email: string;
}

export interface HouseholdData {
  household: Household | null;
  members: HouseholdMember[];
  myRole: 'admin' | 'member' | null;
  activeInvitation: { code: string; expires_at: string } | null;
}

export interface BotBinding {
  id: string;
  platform: 'line' | 'telegram';
  platform_user_id: string;
  display_name: string;
  created_at: string;
}
