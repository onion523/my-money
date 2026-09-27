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

export const useStore = create<AppStore>((set) => {
  // 初始化 auth
  const token = localStorage.getItem('mm_token');
  const userStr = localStorage.getItem('mm_user');
  const user = userStr ? JSON.parse(userStr) : null;

  // 初始化主題
  const savedTheme = localStorage.getItem('mm_theme') as 'light' | 'dark' | null;
  const theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  return {
    // Auth
    user,
    token,
    setAuth: (user, token) => {
      localStorage.setItem('mm_token', token);
      localStorage.setItem('mm_user', JSON.stringify(user));
      set({ user, token });
    },
    logout: () => {
      localStorage.removeItem('mm_token');
      localStorage.removeItem('mm_user');
      set({ user: null, token: null, accounts: [], transactions: [], recurring: [], goals: [], budgets: [], balance: null });
    },

    // Theme
    theme,
    toggleTheme: () => set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mm_theme', next);
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