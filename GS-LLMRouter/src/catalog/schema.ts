import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model_type TEXT NOT NULL,
      input_price REAL,
      output_price REAL,
      context_window INTEGER,
      api_formats TEXT NOT NULL,
      output_modalities TEXT NOT NULL DEFAULT '[]',
      tools_supported INTEGER,
      quality_tier INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      available INTEGER NOT NULL DEFAULT 1,
      raw_json TEXT NOT NULL,
      catalog_updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blacklist (
      pattern TEXT PRIMARY KEY COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      complexity TEXT NOT NULL CHECK (complexity IN ('simple', 'complex')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decision_id TEXT NOT NULL REFERENCES decisions(id),
      success INTEGER NOT NULL CHECK (success IN (0, 1)),
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (decision_id)
    );
    CREATE INDEX IF NOT EXISTS decisions_model_complexity ON decisions(model_id, complexity);
  `);
  // Databases created before output_modalities existed need the column added in place.
  const columns = db.prepare("PRAGMA table_info(models)").all() as Array<{ name: string }>;
  if (!columns.some(({ name }) => name === "output_modalities")) {
    db.exec("ALTER TABLE models ADD COLUMN output_modalities TEXT NOT NULL DEFAULT '[]'");
  }
  return db;
}
