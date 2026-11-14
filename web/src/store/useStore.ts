import { create } from 'zustand';
import { Account, Transaction, RecurringItem, Goal, BudgetWithSpent, BalanceSummary } from '../api/client';

interface User { id: string; email: string; name: string; }

interface AppStore {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Data
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  goals: Goal[];
  budgets: BudgetWithSpent[];
  balance: BalanceSummary | null;
  loading: boolean;

  setAccounts: (accounts: Account[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setRecurring: (recurring: RecurringItem[]) => void;
  setGoals: (goals: Goal[]) => void;
  setBudgets: (budgets: BudgetWithSpent[]) => void;
  setBalance: (balance: BalanceSummary) => void;
  setLoading: (loading: boolean) => void;
}

function getStoredUser(): User | null {
  try {
    const refreshToken = localStorage.getItem('mm_refresh_token');
    const userStr = localStorage.getItem('mm_user');
    if (!refreshToken || !userStr) return null;
    return JSON.parse(userStr);
  } catch {
    try {
      localStorage.removeItem('mm_refresh_token');
      localStorage.removeItem('mm_user');
    } catch (_) {}
    return null;
  }
}

function getStoredTheme(): 'light' | 'dark' {
  try {
    const savedTheme = localStorage.getItem('mm_theme') as 'light' | 'dark' | null;
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (e) {}
  return 'light';
}

export const useStore = create<AppStore>((set) => {
  const user = getStoredUser();
  const theme = getStoredTheme();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }

  return {
    // Auth（Access Token 僅存於記憶體，由 auth/oauth.ts 管理）
    user,
    token: null,
    setAuth: (user, token) => {
      try {
        localStorage.setItem('mm_user', JSON.stringify(user));
      } catch (e) {}
      set({ user, token });
    },
    logout: () => {
      try {
        localStorage.removeItem('mm_token');
        localStorage.removeItem('mm_refresh_token');
        localStorage.removeItem('mm_user');
      } catch (e) {}
      set({ user: null, token: null, accounts: [], transactions: [], recurring: [], goals: [], budgets: [], balance: null });
    },

    // Theme
    theme,
    toggleTheme: () => set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
      }
      try {
        localStorage.setItem('mm_theme', next);
      } catch (e) {}
      return { theme: next };
    }),

    // Data
    accounts: [],
    transactions: [],
    recurring: [],
    goals: [],
    budgets: [],
    balance: null,
    loading: false,
    setAccounts: (accounts) => set({ accounts }),
    setTransactions: (transactions) => set({ transactions }),
    setRecurring: (recurring) => set({ recurring }),
    setGoals: (goals) => set({ goals }),
    setBudgets: (budgets) => set({ budgets }),
    setBalance: (balance) => set({ balance }),
    setLoading: (loading) => set({ loading }),
  };
});
