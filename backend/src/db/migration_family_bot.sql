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
