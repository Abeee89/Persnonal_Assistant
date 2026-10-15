import fs from "node:fs";
import path from "node:path";
import type { DbExec } from "@/db/client";
import { attachments } from "@/db/schema";
import { sql } from "drizzle-orm";

export interface DataUsage {
  dataDir: string;
  databaseBytes: number;
  attachmentBytes: number;
  attachmentCount: number;
}

function fileSize(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/**
 * Reports on-disk footprint without exposing file names or contents. The database
 * figure includes the WAL file so it reflects recent writes.
 */
export function measureDataUsage(db: DbExec, dataDir: string): DataUsage {
  const absolute = path.resolve(dataDir);
  const dbFile = path.join(absolute, "personal-activity.db");
  const row = db
    .select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)` })
    .from(attachments)
    .where(sql`${attachments.status} = 'ready'`)
    .get();
  return {
    dataDir: absolute,
    databaseBytes: fileSize(dbFile) + fileSize(`${dbFile}-wal`),
    attachmentBytes: row?.bytes ?? 0,
    attachmentCount: row?.count ?? 0,
  };
}
