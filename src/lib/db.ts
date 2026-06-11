import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const DB_PATH = path.resolve(process.cwd(), 'railtwin.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
    seedDefaults(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      operator_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      station TEXT NOT NULL,
      scenario_type TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      train_id TEXT NOT NULL,
      predicted_delay INTEGER NOT NULL,
      confidence REAL NOT NULL,
      conditions_json TEXT,
      explanation TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      operator_id INTEGER,
      details_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_code TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedDefaults(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM operators').get() as { c: number };
  if (count.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO operators (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'System Admin');
    db.prepare('INSERT INTO operators (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)').run('operator', bcrypt.hashSync('operator123', 10), 'operator', 'Train Operator');
  }
}

export function logAudit(action: string, operatorId: number | null, details?: Record<string, unknown>) {
  const db = getDb();
  db.prepare('INSERT INTO audit_log (action, operator_id, details_json) VALUES (?, ?, ?)').run(
    action,
    operatorId,
    details ? JSON.stringify(details) : null
  );
}
