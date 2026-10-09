import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { saveDailyEntry } from "@/features/journal/service";
import { journalUpsertSchema } from "@/schemas/journal";
import { MemoryStorage } from "@/lib/storage/memory";
import { findReadable, uploadAttachment } from "./service";

const PDF = new TextEncoder().encode("%PDF-1.7\nbody");
let dir: string;
let handle: DatabaseHandle;
let db: Db;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-bs-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("pending upload becomes readable when the journal entry is saved", () => {
  it("binds in the save transaction and then serves", async () => {
    const storage = new MemoryStorage();
    const ctx = { now: () => "2026-10-02T09:00:00.000Z", newId: () => `f${String(Math.random()).slice(2, 10)}`, storage, maxBytes: 1_000_000 };
    const pending = await uploadAttachment(db, { entityType: "journal", entityId: null, originalName: "doc.pdf", bytes: PDF }, ctx);
    expect(findReadable(db, pending.id)).toBeNull();

    const input = journalUpsertSchema.parse({ date: "2026-10-02", contentJson: "{}", attachmentIds: [pending.id] });
    saveDailyEntry(db, input, { now: ctx.now, newId: ctx.newId });

    const served = findReadable(db, pending.id);
    expect(served?.status).toBe("ready");
    expect(served?.entityId).not.toBeNull();
  });

  it("rolls back the whole save when a bind fails, leaving the file pending", async () => {
    const storage = new MemoryStorage();
    const ctx = { now: () => "2026-10-02T09:00:00.000Z", newId: () => `g${String(Math.random()).slice(2, 10)}`, storage, maxBytes: 1_000_000 };
    const pending = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "doc.pdf", bytes: PDF }, ctx);
    const input = journalUpsertSchema.parse({ date: "2026-10-02", contentJson: "{}", attachmentIds: [pending.id] });
    expect(() => saveDailyEntry(db, input, { now: ctx.now, newId: ctx.newId })).toThrow();
    expect(findReadable(db, pending.id)).toBeNull();
    const journalCount = (handle.sqlite.prepare("SELECT count(*) AS n FROM journals").get() as { n: number }).n;
    expect(journalCount).toBe(0);
  });
});
