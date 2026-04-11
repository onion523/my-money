/** Cloudflare Workers 環境變數綁定 */
export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

/** 使用者基本資訊 */
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** 帳本 */
export interface Book {
  id: string;
  name: string;
  emoji: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

/** 帳本成員 (含 role) */
export interface BookMember {
  book_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

/** 帳本邀請碼 */
export interface BookInvite {
  code: string;
  book_id: string;
  invited_by: string;
  role: 'admin' | 'member';
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

/** Activity feed entry */
export interface BookActivity {
  id: string;
  book_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  summary: string;
  created_at: string;
}

/** 使用者偏好設定 */
export interface UserSettings {
  user_id: string;
  active_book_id: string | null;
  updated_at: string;
}

/** Book context — 由 bookContext middleware 注入 */
export interface BookContext {
  userId: string;
  bookId: string;
  role: 'owner' | 'admin' | 'member';
  /** 若被踢時 auto-fallback 觸發，會帶上要回給 client 的新 active_book_id */
  switchedTo?: string;
}

/** 帳戶 — 對應銀行帳戶或信用卡 */
export interface Account {
  id: string;
  book_id: string;
  created_by: string;
  name: string;
  type: string;
  account_number: string;
  balance: string;
  billing_date: number | null;
  payment_date: number | null;
  billed_amount: string | null;
  unbilled_amount: string | null;
  created_at: string;
  updated_at: string;
}

/** 固定收支 — 定期扣款/收入項目 */
export interface FixedExpense {
  id: string;
  book_id: string;
  created_by: string;
  name: string;
  type: string;
  amount: string;
  cycle: string;
  due_date: string | null;
  due_day: number;
  payment_method: string;
  account_id: string;
  category: string;
  note: string | null;
  reserved_amount: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** 儲蓄目標 */
export interface SavingsGoal {
  id: string;
  book_id: string;
  created_by: string;
  name: string;
  target_amount: string;
  current_amount: string;
  category: string;
  deadline: string | null;
  monthly_reserve: string;
  emoji: string;
  created_at: string;
  updated_at: string;
}

/** 交易紀錄 */
export interface Transaction {
  id: string;
  book_id: string;
  created_by: string;
  type: string;
  amount: string;
  date: string;
  note: string;
  category: string;
  account_id: string | null;
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
