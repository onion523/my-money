-- ============================================================
-- My Money — D1 資料庫結構
-- 對應 Flutter 本地 SQLite schema，每張表加上 user_id 與 updated_at
-- ============================================================

-- 使用者
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,            -- SHA-256 hash with salt
  salt        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 帳戶（銀行帳戶、信用卡）
CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'bank',       -- bank | credit_card
  account_number  TEXT NOT NULL DEFAULT '',           -- 完整帳號/卡號
  balance         TEXT NOT NULL DEFAULT '0',
  billing_date    INTEGER,                            -- 信用卡帳單日
  payment_date    INTEGER,                            -- 信用卡繳款日
  billed_amount   TEXT,                               -- 已出帳金額
  unbilled_amount TEXT,                               -- 未出帳金額
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- 固定收支（定期扣款/收入）
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'expense',     -- expense | income
  amount          TEXT NOT NULL DEFAULT '0',
  cycle           TEXT NOT NULL DEFAULT 'monthly',     -- monthly | bimonthly | quarterly | semi_annual | annual
  due_date        TEXT,                                -- ISO date（下次到期日）
  due_day         INTEGER NOT NULL DEFAULT 1,          -- 每月幾號（1-31）
  payment_method  TEXT NOT NULL DEFAULT '',             -- 付款/收款方式描述
  account_id      TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  note            TEXT,
  reserved_amount TEXT NOT NULL DEFAULT '0',            -- 已預留金額
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);

-- 儲蓄目標
CREATE TABLE IF NOT EXISTS savings_goals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  target_amount   TEXT NOT NULL DEFAULT '0',
  current_amount  TEXT NOT NULL DEFAULT '0',
  category        TEXT NOT NULL DEFAULT '',
  deadline        TEXT,                               -- ISO date
  monthly_reserve TEXT NOT NULL DEFAULT '0',
  emoji           TEXT NOT NULL DEFAULT '🎯',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);

-- 共同儲蓄目標
CREATE TABLE IF NOT EXISTS shared_goals (
  id              TEXT PRIMARY KEY,
  creator_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  target_amount   TEXT NOT NULL DEFAULT '0',
  emoji           TEXT NOT NULL DEFAULT '🎯',
  invite_code     TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shared_goals_creator ON shared_goals(creator_id);
CREATE INDEX IF NOT EXISTS idx_shared_goals_invite ON shared_goals(invite_code);

-- 共同儲蓄目標成員
CREATE TABLE IF NOT EXISTS shared_goal_members (
  id                  TEXT PRIMARY KEY,
  goal_id             TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  user_name           TEXT NOT NULL,
  contributed_amount  TEXT NOT NULL DEFAULT '0',
  joined_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sgm_goal ON shared_goal_members(goal_id);
CREATE INDEX IF NOT EXISTS idx_sgm_user ON shared_goal_members(user_id);

-- 交易紀錄
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'expense',
  amount      TEXT NOT NULL,
  date        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  account_id  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date);
