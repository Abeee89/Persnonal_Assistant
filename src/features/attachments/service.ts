import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { activities, attachments, goals, journals, tasks } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { buildStorageKey } from "@/lib/files/keys";
import { sanitizeOriginalName } from "@/lib/files/names";
import { sniffMime, SNIFF_TYPES, type SniffedMime } from "@/lib/files/magic";
import type { StorageProvider } from "@/lib/storage/types";
import type { AttachmentEntityType } from "./types";

export const PENDING_TTL_MS = 72 * 60 * 60 * 1000;

export interface AttachmentView {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string | null;
  originalName: string;
  mimeType: SniffedMime;
  sizeBytes: number;
  kind: string;
  status: "pending" | "ready" | "orphan";
  createdAt: string;
  url: string;
}

export interface UploadContext {
  now: () => string;
  newId: () => string;
  storage: StorageProvider;
  maxBytes: number;
}

export interface UploadInput {
  entityType: AttachmentEntityType;
  entityId: string | null;
  originalName: string;
  bytes: Uint8Array;
}

const MIN_BYTES = 1;

export function viewOf(row: typeof attachments.$inferSelect): AttachmentView {
  return {
    id: row.id,
    entityType: row.entityType as AttachmentEntityType,
    entityId: row.entityId,
    originalName: row.originalName,
    mimeType: row.mimeType as SniffedMime,
    sizeBytes: row.sizeBytes,
    kind: row.kind,
    status: row.status as AttachmentView["status"],
    createdAt: row.createdAt,
    url: `/api/files/${row.id}`,
  };
}

function entityIsLive(db: DbExec, entityType: AttachmentEntityType, entityId: string): boolean {
  switch (entityType) {
    case "activity":
      return (
        db
          .select({ id: activities.id })
          .from(activities)
          .where(and(eq(activities.id, entityId), isNull(activities.deletedAt)))
          .get() !== undefined
      );
    case "journal":
      return (
        db
          .select({ id: journals.id })
          .from(journals)
          .where(and(eq(journals.id, entityId), isNull(journals.deletedAt)))
          .get() !== undefined
      );
    case "goal":
      return (
        db
          .select({ id: goals.id })
          .from(goals)
          .where(and(eq(goals.id, entityId), isNull(goals.deletedAt)))
          .get() !== undefined
      );
    case "task":
      return db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, entityId)).get() !== undefined;
  }
}

/**
 * Validates and stores an upload (SDD §08 §4). Order matters: size, then magic
 * bytes (never the client MIME), then bind target, then write, then row.
 */
export async function uploadAttachment(db: Db, input: UploadInput, ctx: UploadContext): Promise<AttachmentView> {
  if (input.bytes.byteLength < MIN_BYTES) {
    throw new AppError("VALIDATION", "The file is empty.", { fieldErrors: { file: ["The file is empty."] } });
  }
  if (input.bytes.byteLength > ctx.maxBytes) {
    throw new AppError("FILE_TOO_LARGE", `File exceeds the ${String(Math.round(ctx.maxBytes / 1024 / 1024))} MB limit.`);
  }
  const mime = sniffMime(input.bytes);
  if (!mime) {
    throw new AppError("FILE_TYPE_UNSUPPORTED", "Only JPG, PNG, WEBP and PDF files are supported.");
  }
  if (input.entityId !== null && !entityIsLive(db, input.entityType, input.entityId)) {
    throw new AppError("VALIDATION", "The item you are attaching to no longer exists.", {
      fieldErrors: { entityId: ["Target not found."] },
    });
  }

  const id = ctx.newId();
  const now = ctx.now();
  const ext = SNIFF_TYPES[mime].ext;
  const key = buildStorageKey(input.entityType, id, ext, now.slice(0, 10));
  const checksum = createHash("sha256").update(input.bytes).digest("hex");

  try {
    await ctx.storage.put(key, input.bytes);
  } catch (error: unknown) {
    throw new AppError("STORAGE", "Could not save the file. Try again.", { cause: error });
  }

  db.insert(attachments)
    .values({
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      filename: `${id}.${ext}`,
      originalName: sanitizeOriginalName(input.originalName),
      mimeType: mime,
      sizeBytes: input.bytes.byteLength,
      storagePath: key,
      kind: SNIFF_TYPES[mime].kind,
      checksum,
      status: input.entityId === null ? "pending" : "ready",
      createdAt: now,
    })
    .run();

  const row = db.select().from(attachments).where(eq(attachments.id, id)).get();
  if (!row) {
    throw new AppError("DB", "Could not record the file.");
  }
  return viewOf(row);
}

/**
 * Binds pending uploads to an entity inside one transaction, so an entity save
 * and its attachments commit together (SDD §08 §4 step 8).
 */
export function bindAttachments(
  db: DbExec,
  ids: readonly string[],
  entityType: AttachmentEntityType,
  entityId: string,
): AttachmentView[] {
  if (!entityIsLive(db, entityType, entityId)) {
    throw new AppError("NOT_FOUND", "The item you are attaching to was not found.");
  }
  if (ids.length === 0) {
    return [];
  }
  const rows = db
    .select()
    .from(attachments)
    .where(inArray(attachments.id, [...ids]))
    .all();
  if (rows.length !== new Set(ids).size) {
    throw new AppError("VALIDATION", "Some files could not be found.", {
      fieldErrors: { attachmentIds: ["Unknown attachment."] },
    });
  }
  for (const row of rows) {
    if (row.status !== "pending" || row.entityType !== entityType) {
      throw new AppError("CONFLICT", "A file was already attached elsewhere.");
    }
  }
  db.update(attachments)
    .set({ entityId, status: "ready" })
    .where(inArray(attachments.id, [...ids]))
    .run();
  return db
    .select()
    .from(attachments)
    .where(inArray(attachments.id, [...ids]))
    .all()
    .map(viewOf);
}

export function listForEntity(db: DbExec, entityType: AttachmentEntityType, entityId: string): AttachmentView[] {
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId),
        eq(attachments.status, "ready"),
      ),
    )
    .all()
    .map(viewOf);
}

export function findReadable(db: DbExec, id: string): (typeof attachments.$inferSelect) | null {
  const row = db.select().from(attachments).where(eq(attachments.id, id)).get();
  if (!row || row.status !== "ready") {
    return null;
  }
  return row;
}

/** Hard-removes a ready attachment: row first, then the file. */
export async function deleteAttachment(db: Db, id: string, storage: StorageProvider): Promise<void> {
  const row = db.select().from(attachments).where(eq(attachments.id, id)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", "File not found.");
  }
  db.delete(attachments).where(eq(attachments.id, id)).run();
  await storage.delete(row.storagePath);
}

/** Removes pending uploads older than 72 h that were never bound (SDD §08 §5). */
export async function sweepPending(db: Db, storage: StorageProvider, nowIso: string): Promise<number> {
  const cutoff = new Date(new Date(nowIso).getTime() - PENDING_TTL_MS).toISOString();
  const stale = db
    .select()
    .from(attachments)
    .where(and(eq(attachments.status, "pending"), lt(attachments.createdAt, cutoff)))
    .all();
  for (const row of stale) {
    db.delete(attachments).where(eq(attachments.id, row.id)).run();
    await storage.delete(row.storagePath);
  }
  return stale.length;
}
