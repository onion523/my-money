-- ============================================================
-- My Money — D1 資料庫結構
-- 對應 Flutter 本地 SQLite schema，每張表加上 user_id 與 updated_at
-- ============================================================

-- 帳戶（銀行帳戶、信用卡、現金、投資帳戶）
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'bank',       -- bank | credit_card | cash | investment
  currency    TEXT NOT NULL DEFAULT 'TWD',
  balance     REAL NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- 固定支出（每月/每年定期扣款）
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  amount      REAL NOT NULL,
  frequency   TEXT NOT NULL DEFAULT 'monthly',    -- monthly | yearly
  due_day     INTEGER NOT NULL DEFAULT 1,
  account_id  TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  note        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);

-- 儲蓄目標
CREATE TABLE IF NOT EXISTS savings_goals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  target_amount   REAL NOT NULL,
  current_amount  REAL NOT NULL DEFAULT 0,
  deadline        TEXT,
  note            TEXT,
  is_completed    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);

-- 交易紀錄
CREATE TABLE IF NOT EXISTS transactions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  account_id          TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'expense',  -- income | expense | transfer
  amount              REAL NOT NULL,
  category            TEXT NOT NULL DEFAULT '',
  description         TEXT,
  date                TEXT NOT NULL,                     -- YYYY-MM-DD
  related_account_id  TEXT,                              -- 轉帳目標帳戶
  note                TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (related_account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date);
