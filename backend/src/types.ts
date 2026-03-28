/** Cloudflare Workers 環境變數綁定 */
export interface Env {
  DB: D1Database;
}

/** 帳戶 — 對應銀行帳戶或信用卡 */
export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;         // 'bank' | 'credit_card' | 'cash' | 'investment'
  currency: string;     // 'TWD' | 'USD' ...
  balance: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 固定支出 — 每月/每年固定扣款項目 */
export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: string;    // 'monthly' | 'yearly'
  due_day: number;      // 每月幾號扣款（1-31）
  account_id: string;
  category: string;
  note: string | null;
  is_active: number;    // 0 或 1（SQLite 無布林值）
  created_at: string;
  updated_at: string;
}

/** 儲蓄目標 */
export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  note: string | null;
  is_completed: number; // 0 或 1
  created_at: string;
  updated_at: string;
}

/** 交易紀錄 */
export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: string;         // 'income' | 'expense' | 'transfer'
  amount: number;
  category: string;
  description: string | null;
  date: string;         // YYYY-MM-DD
  related_account_id: string | null; // 轉帳目標帳戶
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 同步請求：客戶端上傳的一個表格的變更 */
export interface SyncRequest {
  table: 'accounts' | 'fixed_expenses' | 'savings_goals' | 'transactions';
  records: SyncRecord[];
}

/** 單筆同步紀錄 */
export interface SyncRecord {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

/** 同步回應：伺服器端較新的紀錄，讓客戶端更新 */
export interface SyncResponse {
  server_wins: SyncRecord[];
  client_wins_applied: number;
}

/** JSON 回應的通用包裝 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
