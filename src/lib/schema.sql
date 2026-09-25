-- Mephisto's Bargain: Soul Coin System Database Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_number INTEGER UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  access_key TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('ORGANIZER_GRANT', 'ORGANIZER_DEDUCT', 'TRANSFER')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  source_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  destination_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  badge TEXT NOT NULL DEFAULT 'General / Adjustment',
  note TEXT,
  created_by TEXT NOT NULL CHECK(created_by IN ('ORGANIZER', 'PARTICIPANT')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_number ON teams(team_number);
CREATE INDEX IF NOT EXISTS idx_teams_access_key ON teams(access_key);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source_team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_destination ON transactions(destination_team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
