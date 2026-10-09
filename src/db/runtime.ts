import path from "node:path";
import { parseEnv } from "@/config/env";
import { openDatabase, type Db, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import { seedDefaultCategories } from "./seed";

export const DATABASE_FILENAME = "personal-activity.db";

let handle: DatabaseHandle | undefined;

/**
 * Process-wide database singleton. First call opens the file under DATA_DIR,
 * applies pending migrations and seeds default categories (SDD §06 §8).
 */
export function getDb(): Db {
  if (!handle) {
    const env = parseEnv(process.env);
    const file = path.join(path.resolve(env.DATA_DIR), DATABASE_FILENAME);
    const opened = openDatabase({ file });
    runMigrations(opened.db);
    seedDefaultCategories(opened.db);
    handle = opened;
  }
  return handle.db;
}

export function closeDb(): void {
  handle?.close();
  handle = undefined;
}
