/** Cloudflare Workers 環境變數綁定 */
export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

/** 帳戶 — 對應銀行帳戶或信用卡 */
export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;                    // 'bank' | 'credit_card'
  account_number: string;          // 帳號後幾碼
  balance: string;                 // Decimal stored as TEXT
  billing_date: number | null;     // 信用卡帳單日
  payment_date: number | null;     // 信用卡繳款日
  billed_amount: string | null;    // 已出帳金額
  unbilled_amount: string | null;  // 未出帳金額
  created_at: string;
  updated_at: string;
}

/** 固定收支 — 定期扣款/收入項目 */
export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  type: string;              // 'expense' | 'income'
  amount: string;            // Decimal stored as TEXT
  cycle: string;             // 'monthly' | 'bimonthly' | 'quarterly' | 'semi_annual' | 'annual'
  due_date: string | null;   // ISO date（下次到期日）
  due_day: number;           // 每月幾號（1-31）
  payment_method: string;    // 付款/收款方式描述
  account_id: string;
  category: string;
  note: string | null;
  reserved_amount: string;   // 已預留金額
  is_active: number;         // 0 或 1
  created_at: string;
  updated_at: string;
}

/** 儲蓄目標 */
export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: string;           // Decimal stored as TEXT
  current_amount: string;          // Decimal stored as TEXT
  category: string;
  deadline: string | null;         // ISO date
  monthly_reserve: string;         // Decimal stored as TEXT
  emoji: string;
  created_at: string;
  updated_at: string;
}

/** 交易紀錄 */
export interface Transaction {
  id: string;
  user_id: string;
  type: string;                    // 'income' | 'expense'
  amount: string;                  // Decimal stored as TEXT
  date: string;                    // YYYY-MM-DD
  note: string;
  category: string;
  account_id: string | null;
  created_at: string;
}

/** 共同儲蓄目標 */
export interface SharedGoal {
  id: string;
  creator_id: string;
  name: string;
  target_amount: string;
  emoji: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

/** 共同儲蓄目標成員 */
export interface SharedGoalMember {
  id: string;
  goal_id: string;
  user_id: string;
  user_name: string;
  contributed_amount: string;
  joined_at: string;
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
