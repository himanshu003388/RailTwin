import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// On Vercel the project dir is read-only; only /tmp is writable.
const DB_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'railtwin.db')
  : path.resolve(process.cwd(), 'railtwin.db');

let _db: Database.Database | null = null;
let _failed = false;

export function getDb(): Database.Database | null {
  if (_db) return _db;
  if (_failed) return null;

  try {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
    return _db;
  } catch (err) {
    console.warn('SQLite unavailable, persistence disabled:', (err as any)?.message || err);
    _failed = true;
    return null;
  }
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

    CREATE TABLE IF NOT EXISTS baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baseline_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      snapshot_json TEXT NOT NULL,
      captured_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      entity TEXT NOT NULL,
      field TEXT NOT NULL,
      resolution TEXT NOT NULL,
      item_json TEXT NOT NULL,
      resolved_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function logAudit(action: string, details?: Record<string, unknown>) {
  const db = getDb();
  if (!db) return; // persistence disabled, fail safe
  try {
    db.prepare('INSERT INTO audit_log (action, details_json) VALUES (?, ?)').run(
      action,
      details ? JSON.stringify(details) : null,
    );
  } catch (err) {
    console.warn('audit log write failed:', (err as any)?.message || err);
  }
}
