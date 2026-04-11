-- ============================================================
-- My Money — D1 資料庫結構 (book-centric, multi-user shared books)
-- ============================================================
-- 設計原則:
--   - book 是資料分區單位 (取代 user_id)
--   - user_id 退化成 created_by (audit) + book 成員關係
--   - 三階角色: owner / admin / member
--   - 砍掉重建: 不保留舊資料
-- ============================================================

-- ── 砍掉所有舊表 ──
DROP TABLE IF EXISTS device_tokens;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS book_activities;
DROP TABLE IF EXISTS book_invites;
DROP TABLE IF EXISTS book_members;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS savings_goals;
DROP TABLE IF EXISTS fixed_expenses;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

-- ── 1. 使用者 ──
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,            -- SHA-256 hash with salt
  salt        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_email ON users(email);

-- ── 2. 帳本 ──
CREATE TABLE books (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  emoji         TEXT NOT NULL DEFAULT '📒',
  owner_user_id TEXT NOT NULL,                            -- 唯一能刪帳本/轉移 owner
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
CREATE INDEX idx_books_owner ON books(owner_user_id);

-- ── 3. 帳本成員 ──
CREATE TABLE book_members (
  book_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  joined_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_book_members_user ON book_members(user_id);

-- ── 4. 邀請碼 ──
CREATE TABLE book_invites (
  code        TEXT PRIMARY KEY,                          -- 12 字 URL-safe
  book_id     TEXT NOT NULL,
  invited_by  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  used_by     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id)
);
CREATE INDEX idx_invites_book ON book_invites(book_id);

-- ── 5. Activity feed ──
CREATE TABLE book_activities (
  id          TEXT PRIMARY KEY,
  book_id     TEXT NOT NULL,
  user_id     TEXT,                                       -- ON DELETE SET NULL
  action      TEXT NOT NULL,                              -- 'create_transaction' 等
  resource    TEXT NOT NULL,                              -- 'transaction' | 'account' ...
  resource_id TEXT,
  summary     TEXT NOT NULL,                              -- "新增 早餐 $80"
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_activities_book_time ON book_activities(book_id, created_at DESC);

-- ── 6. 使用者設定 (active_book 等) ──
CREATE TABLE user_settings (
  user_id        TEXT PRIMARY KEY,
  active_book_id TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (active_book_id) REFERENCES books(id) ON DELETE SET NULL
);

-- ── 7. FCM device tokens (PR6 用) ──
CREATE TABLE device_tokens (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('web','android','ios')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_tokens_user ON device_tokens(user_id);

-- ============================================================
-- Domain tables (book-centric)
-- 共通:
--   - book_id    TEXT NOT NULL  (FK → books, ON DELETE CASCADE)
--   - created_by TEXT NOT NULL  (FK → users, no cascade)
-- ============================================================

-- ── 8. 帳戶 ──
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  book_id         TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'bank',
  account_number  TEXT NOT NULL DEFAULT '',
  balance         TEXT NOT NULL DEFAULT '0',
  billing_date    INTEGER,
  payment_date    INTEGER,
  billed_amount   TEXT,
  unbilled_amount TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX idx_accounts_book ON accounts(book_id);
CREATE INDEX idx_accounts_book_updated ON accounts(book_id, updated_at);

-- ── 9. 固定收支 ──
CREATE TABLE fixed_expenses (
  id              TEXT PRIMARY KEY,
  book_id         TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'expense',
  amount          TEXT NOT NULL DEFAULT '0',
  cycle           TEXT NOT NULL DEFAULT 'monthly',
  due_date        TEXT,
  due_day         INTEGER NOT NULL DEFAULT 1,
  payment_method  TEXT NOT NULL DEFAULT '',
  account_id      TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  note            TEXT,
  reserved_amount TEXT NOT NULL DEFAULT '0',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX idx_fixed_expenses_book ON fixed_expenses(book_id);
CREATE INDEX idx_fixed_expenses_book_updated ON fixed_expenses(book_id, updated_at);

-- ── 10. 儲蓄目標 ──
CREATE TABLE savings_goals (
  id              TEXT PRIMARY KEY,
  book_id         TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  name            TEXT NOT NULL,
  target_amount   TEXT NOT NULL DEFAULT '0',
  current_amount  TEXT NOT NULL DEFAULT '0',
  category        TEXT NOT NULL DEFAULT '',
  deadline        TEXT,
  monthly_reserve TEXT NOT NULL DEFAULT '0',
  emoji           TEXT NOT NULL DEFAULT '🎯',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX idx_savings_goals_book ON savings_goals(book_id);
CREATE INDEX idx_savings_goals_book_updated ON savings_goals(book_id, updated_at);

-- ── 11. 交易紀錄 ──
CREATE TABLE transactions (
  id          TEXT PRIMARY KEY,
  book_id     TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'expense',
  amount      TEXT NOT NULL,
  date        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  account_id  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX idx_transactions_book ON transactions(book_id);
CREATE INDEX idx_transactions_book_date ON transactions(book_id, date);
CREATE INDEX idx_transactions_book_updated ON transactions(book_id, updated_at);
