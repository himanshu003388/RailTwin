import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'railtwin.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      station TEXT NOT NULL,
      scenario_type TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      train_id TEXT NOT NULL,
      predicted_delay INTEGER NOT NULL,
      confidence REAL NOT NULL,
      conditions_json TEXT,
      explanation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_code TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function logAudit(action: string, details?: Record<string, unknown>) {
  const db = getDb();
  db.prepare('INSERT INTO audit_log (action, details_json) VALUES (?, ?)').run(
    action,
    details ? JSON.stringify(details) : null
  );
}
