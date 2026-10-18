PRAGMA foreign_keys = ON;

-- Users Table with Role-Based Access Control (RBAC) tiers
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- Asynchronous Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0.0),
  currency TEXT NOT NULL DEFAULT 'USD',
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  worker_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Security & RBAC Audit Trail Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  role TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  ip TEXT,
  status_code INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- Optimized Relational Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
