import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(import.meta.dir, "../../data");
const DB_PATH = join(DATA_DIR, "aff.db");

let db: Database;

export function getDB(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.run("PRAGMA journal_mode=WAL");
    db.run("PRAGMA foreign_keys=ON");
  }
  return db;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function safeParseConfig(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    console.error("CRITICAL: Failed to parse persona config from DB. Data may be corrupted.");
    return {};
  }
}

export function initDB() {
  const d = getDB();
  const schemaPath = join(import.meta.dir, "schema.sql");
  let sql: string;
  try {
    sql = readFileSync(schemaPath, "utf-8");
  } catch {
    throw new Error(`Failed to read schema file: ${schemaPath}`);
  }
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    d.run(stmt + ";");
  }
  return d;
}

export function closeDB() {
  if (db) {
    db.close();
  }
}
