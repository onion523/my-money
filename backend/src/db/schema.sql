-- =====================
-- my-money D1 Schema
-- =====================

-- 用戶
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 帳戶（銀行 + 信用卡）
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('bank', 'credit_card', 'cash')),
  balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  statement_day INTEGER,
  payment_due_day INTEGER,
  unbilled REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#FF8A8A',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 交易記錄
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT DEFAULT '',
  date TEXT NOT NULL,
  is_shared INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 固定收支
CREATE TABLE IF NOT EXISTS recurring_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount REAL NOT NULL,
  cycle TEXT NOT NULL CHECK(cycle IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual')),
  day_of_cycle INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 儲蓄目標
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  target_amount REAL NOT NULL,
  saved_amount REAL NOT NULL DEFAULT 0,
  monthly_reserve REAL NOT NULL DEFAULT 0,
  deadline TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 月度預算
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  month TEXT NOT NULL,
  UNIQUE(user_id, category, month)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_items(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
-- =============================================
-- Migration: Family Households & Bot Bindings
-- =============================================

-- 1. 家庭群組
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 家庭成員
CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'member')) DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, user_id)
);

-- 3. 家庭邀請碼
CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bot 綁定
CREATE TABLE IF NOT EXISTS bot_bindings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('line', 'telegram')),
  platform_user_id TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, platform_user_id)
);

-- 5. Bot 配對碼 (有效時間戳)
CREATE TABLE IF NOT EXISTS bot_pairing_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_hm_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hm_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON household_invitations(code);
CREATE INDEX IF NOT EXISTS idx_bot_user ON bot_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_platform_user ON bot_bindings(platform, platform_user_id);

