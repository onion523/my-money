import { USER2 } from './harness';

export interface Case {
  name: string;
  path: string;
  method?: string;
  body?: unknown;
  user?: string;
}

/** 基準測試與耗時量測共用的端點清單 */
export const CASES: Case[] = [
  { name: 'accounts list (u1)', path: '/accounts' },
  { name: 'accounts list (u2)', path: '/accounts', user: USER2 },
  { name: 'accounts balance (u1)', path: '/accounts/balance' },
  { name: 'accounts balance (u2)', path: '/accounts/balance', user: USER2 },
  { name: 'forecast all', path: '/forecast?scope=all' },
  { name: 'forecast household', path: '/forecast?scope=household' },
  { name: 'forecast personal', path: '/forecast?scope=personal' },
  { name: 'forecast all (u2)', path: '/forecast?scope=all', user: USER2 },
  { name: 'purchase-check all', path: '/forecast/purchase-check', method: 'POST', body: { amount: 30000, scope: 'all' } },
  { name: 'purchase-check household', path: '/forecast/purchase-check', method: 'POST', body: { amount: 90000, scope: 'household' } },
  { name: 'purchase-check personal', path: '/forecast/purchase-check', method: 'POST', body: { amount: 200000, scope: 'personal' } },
  { name: 'transactions page1 (all)', path: '/transactions?limit=30' },
  { name: 'transactions page1 (household)', path: '/transactions?limit=30&scope=household' },
  { name: 'transactions page1 (personal)', path: '/transactions?limit=30&scope=personal' },
  { name: 'transactions offset 30', path: '/transactions?limit=30&offset=30' },
  { name: 'transactions by account', path: '/transactions?limit=50&account_id=a_card1' },
  { name: 'transactions date range', path: '/transactions?limit=50&from=2026-03-01&to=2026-04-30' },
  { name: 'summary category', path: '/transactions/summary/category?month=2026-05&scope=all' },
  { name: 'summary monthly', path: '/transactions/summary/monthly?year=2026&scope=all' },
  { name: 'summary household-shares', path: '/transactions/summary/household-shares?month=2026-05' },
  { name: 'budgets 2026-05', path: '/budgets?month=2026-05' },
  { name: 'budgets 2026-06', path: '/budgets?month=2026-06' },
  { name: 'goals', path: '/goals' },
  { name: 'recurring', path: '/recurring' },
  { name: 'households current', path: '/households/current' },
  { name: 'households advances', path: '/households/advances' },
];
