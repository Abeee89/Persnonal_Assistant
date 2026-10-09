import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import type { RunResult } from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { schema } from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** Accepts either the root database or a transaction handle. */
export type DbExec = BaseSQLiteDatabase<"sync", RunResult, typeof schema>;

export interface OpenDatabaseOptions {
  /** Absolute or relative path to the .db file, or ":memory:". */
  file: string;
  /** Open read-only (used by recovery mode). */
  readonly?: boolean;
}

export interface DatabaseHandle {
  db: Db;
  sqlite: Database.Database;
  close: () => void;
}

export function applyPragmas(sqlite: Database.Database, options: { memory: boolean }): void {
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("temp_store = MEMORY");
  sqlite.pragma("cache_size = -32000");
  if (!options.memory) {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
  }
}

export function openDatabase(options: OpenDatabaseOptions): DatabaseHandle {
  const memory = options.file === ":memory:";
  if (!memory) {
    fs.mkdirSync(path.dirname(path.resolve(options.file)), { recursive: true });
  }
  const sqlite = new Database(options.file, {
    readonly: options.readonly ?? false,
    fileMustExist: false,
  });
  applyPragmas(sqlite, { memory });
  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    close: () => {
      sqlite.close();
    },
  };
}
