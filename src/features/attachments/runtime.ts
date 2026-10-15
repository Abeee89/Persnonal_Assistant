import path from "node:path";
import type { Db } from "@/db/client";
import { parseEnv } from "@/config/env";
import { getDb } from "@/db/runtime";
import { getPreferences } from "@/features/preferences/service";
import { uuidv7 } from "@/lib/ids";
import { LocalFsStorage } from "@/lib/storage/local-fs";
import { MemoryStorage } from "@/lib/storage/memory";
import type { StorageProvider } from "@/lib/storage/types";

let storage: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (!storage) {
    const env = parseEnv(process.env);
    storage =
      env.ATTACHMENT_BACKEND === "memory"
        ? new MemoryStorage()
        : new LocalFsStorage(path.join(path.resolve(env.DATA_DIR), "attachments"));
  }
  return storage;
}

export function attachmentMaxBytes(db: Db = getDb()): number {
  const env = parseEnv(process.env);
  return getPreferences(db, env.ATTACHMENT_MAX_BYTES).attachmentMaxBytes;
}

export function attachmentContext() {
  const db = getDb();
  return {
    db,
    storage: getStorage(),
    now: () => new Date().toISOString(),
    newId: () => uuidv7(),
    maxBytes: attachmentMaxBytes(db),
  };
}
