// 共用型別定義
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  salt: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'credit_card' | 'cash';
  balance: number;
  credit_limit?: number;
  statement_day?: number;
  payment_due_day?: number;
  unbilled: number;
  color: string;
  is_joint?: number;
  shared_debt?: number;
  personal_debt?: number;
  created_at: string;
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
  is_shared: number;
  created_at: string;
  user_name?: string;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  cycle: 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual';
  day_of_cycle: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number;
  saved_amount: number;
  monthly_reserve: number;
  deadline?: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
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

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  code: string;
  inviter_id: string;
  expires_at: string;
  created_at: string;
}

export interface BotBinding {
  id: string;
  user_id: string;
  platform: 'line' | 'telegram';
  platform_user_id: string;
  display_name: string;
  created_at: string;
}

export interface JWTPayload {
  sub: string;  // user id
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

