const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/app.db';
const resolved = path.resolve(process.cwd(), DB_PATH);
fs.mkdirSync(path.dirname(resolved), { recursive: true });

const db = new Database(resolved);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('associate','manager','admin')) DEFAULT 'associate',
  pto_balance_hours REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  hours REAL,
  source TEXT NOT NULL DEFAULT 'clock' CHECK (source IN ('clock','manual')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pto_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vacation','sick','personal','other')) DEFAULT 'vacation',
  hours_requested REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','cancelled')) DEFAULT 'pending',
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_pto_user ON pto_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pto_status ON pto_requests(status);
`);

// One-time bootstrap: create the first admin account from .env if the
// users table is empty. After this, all accounts are managed in-app by
// an admin (add one-by-one or bulk-import via CSV).
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const name = process.env.ADMIN_NAME || 'Admin';
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role, pto_balance_hours) VALUES (?, ?, ?, 'admin', 0)`
  ).run(name, email, hash);
  console.log(`Created first admin account: ${email} (password from .env — change it after first login)`);
}

module.exports = db;
