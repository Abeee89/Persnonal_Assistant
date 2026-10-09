import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { activities, attachments } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { MemoryStorage } from "@/lib/storage/memory";
import {
  bindAttachments,
  deleteAttachment,
  findReadable,
  listForEntity,
  PENDING_TTL_MS,
  sweepPending,
  uploadAttachment,
  type UploadContext,
} from "./service";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...new TextEncoder().encode("JFIF-body")]);
const PDF = new TextEncoder().encode("%PDF-1.7\nbody");
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

let tmpDir: string;
let handle: DatabaseHandle;
let db: Db;
let storage: MemoryStorage;
let idCounter = 0;
let clock = 0;

const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 9, 2, 9) + offsetMs + clock++).toISOString();

function ctx(overrides: Partial<UploadContext> = {}): UploadContext {
  return {
    now: () => iso(),
    newId: () => `att${String(++idCounter).padStart(4, "0")}`,
    storage,
    maxBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

function seedActivity(id = "act-1", deletedAt: string | null = null) {
  db.insert(activities)
    .values({ id, title: "Whiteboard", date: "2026-10-02", createdAt: iso(), updatedAt: iso(), deletedAt })
    .run();
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-att-"));
  handle = openDatabase({ file: path.join(tmpDir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  storage = new MemoryStorage();
  idCounter = 0;
  clock = 0;
});

afterEach(() => {
  handle.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("uploadAttachment validation", () => {
  it("stores a valid JPEG as pending when no entity is given", async () => {
    const view = await uploadAttachment(
      db,
      { entityType: "activity", entityId: null, originalName: "photo.jpg", bytes: JPEG },
      ctx(),
    );
    expect(view.status).toBe("pending");
    expect(view.mimeType).toBe("image/jpeg");
    expect(view.kind).toBe("image");
    expect(view.url).toBe(`/api/files/${view.id}`);
    expect(await storage.exists(`activity/2026/10/${view.id}.jpg`)).toBe(true);
  });

  it("trusts magic bytes, not the file name: HTML named .jpg is rejected", async () => {
    await expect(
      uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "x.jpg", bytes: HTML }, ctx()),
    ).rejects.toMatchObject({ code: "FILE_TYPE_UNSUPPORTED" });
  });

  it("rejects files over the size cap", async () => {
    await expect(
      uploadAttachment(
        db,
        { entityType: "activity", entityId: null, originalName: "big.pdf", bytes: PDF },
        ctx({ maxBytes: 4 }),
      ),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rejects empty uploads", async () => {
    await expect(
      uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "a", bytes: new Uint8Array() }, ctx()),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("never stores the user's file name in the storage path", async () => {
    const view = await uploadAttachment(
      db,
      { entityType: "journal", entityId: null, originalName: "../../etc/passwd.pdf", bytes: PDF },
      ctx(),
    );
    const row = db.select().from(attachments).get();
    expect(row?.storagePath).toBe(`journal/2026/10/${view.id}.pdf`);
    expect(row?.originalName).toBe("passwd.pdf");
    expect(row?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to attach to a target that does not exist", async () => {
    await expect(
      uploadAttachment(db, { entityType: "activity", entityId: "ghost", originalName: "a.pdf", bytes: PDF }, ctx()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses to attach to a soft-deleted target", async () => {
    seedActivity("act-dead", iso());
    await expect(
      uploadAttachment(db, { entityType: "activity", entityId: "act-dead", originalName: "a.pdf", bytes: PDF }, ctx()),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("uploads with a live target directly as ready", async () => {
    seedActivity();
    const view = await uploadAttachment(
      db,
      { entityType: "activity", entityId: "act-1", originalName: "a.pdf", bytes: PDF },
      ctx(),
    );
    expect(view.status).toBe("ready");
    expect(listForEntity(db, "activity", "act-1")).toHaveLength(1);
  });

  it("reports a storage failure as STORAGE without writing a row", async () => {
    const failing = new MemoryStorage();
    failing.put = () => Promise.reject(new Error("disk full"));
    await expect(
      uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "a.pdf", bytes: PDF }, ctx({ storage: failing })),
    ).rejects.toMatchObject({ code: "STORAGE" });
    expect((handle.sqlite.prepare("SELECT count(*) AS n FROM attachments").get() as { n: number }).n).toBe(0);
  });
});

describe("bindAttachments", () => {
  it("binds pending files to an entity and marks them ready", async () => {
    seedActivity();
    const up = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "a.pdf", bytes: PDF }, ctx());
    const bound = bindAttachments(db, [up.id], "activity", "act-1");
    expect(bound[0]).toMatchObject({ status: "ready", entityId: "act-1" });
    expect(listForEntity(db, "activity", "act-1").map((a) => a.id)).toEqual([up.id]);
  });

  it("cannot bind an attachment of another entity type", async () => {
    seedActivity();
    const up = await uploadAttachment(db, { entityType: "journal", entityId: null, originalName: "a.pdf", bytes: PDF }, ctx());
    expect(() => bindAttachments(db, [up.id], "activity", "act-1")).toThrow(AppError);
  });

  it("cannot re-bind a file that is already attached", async () => {
    seedActivity();
    const up = await uploadAttachment(db, { entityType: "activity", entityId: "act-1", originalName: "a.pdf", bytes: PDF }, ctx());
    seedActivity("act-2");
    expect(() => bindAttachments(db, [up.id], "activity", "act-2")).toThrow(/already attached/);
  });

  it("rejects unknown attachment ids and a missing target entity", async () => {
    seedActivity();
    expect(() => bindAttachments(db, ["nope"], "activity", "act-1")).toThrow(AppError);
    const up = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "a.pdf", bytes: PDF }, ctx());
    expect(() => bindAttachments(db, [up.id], "activity", "ghost")).toThrow(/no longer|not found/i);
  });
});

describe("findReadable and delete", () => {
  it("serves only ready attachments", async () => {
    seedActivity();
    const pending = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "a.pdf", bytes: PDF }, ctx());
    expect(findReadable(db, pending.id)).toBeNull();
    bindAttachments(db, [pending.id], "activity", "act-1");
    expect(findReadable(db, pending.id)?.mimeType).toBe("application/pdf");
  });

  it("deletes the row and the stored file", async () => {
    seedActivity();
    const up = await uploadAttachment(db, { entityType: "activity", entityId: "act-1", originalName: "a.pdf", bytes: PDF }, ctx());
    await deleteAttachment(db, up.id, storage);
    expect(findReadable(db, up.id)).toBeNull();
    expect(await storage.exists(`activity/2026/10/${up.id}.pdf`)).toBe(false);
  });

  it("reports NOT_FOUND for unknown ids", async () => {
    await expect(deleteAttachment(db, "nope", storage)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("sweepPending", () => {
  it("removes stale unbound uploads and keeps fresh ones and bound ones", async () => {
    seedActivity();
    const stale = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "old.pdf", bytes: PDF }, ctx({ now: () => "2026-09-01T00:00:00.000Z" }));
    const fresh = await uploadAttachment(db, { entityType: "activity", entityId: null, originalName: "new.pdf", bytes: PDF }, ctx());
    const bound = await uploadAttachment(db, { entityType: "activity", entityId: "act-1", originalName: "kept.pdf", bytes: PDF }, ctx({ now: () => "2026-09-01T00:00:00.000Z" }));

    const removed = await sweepPending(db, storage, new Date(Date.parse("2026-10-02T09:00:00Z") + PENDING_TTL_MS).toISOString());
    expect(removed).toBe(1);
    expect(findReadable(db, bound.id)).not.toBeNull();
    const remaining = db.select({ id: attachments.id }).from(attachments).all().map((r) => r.id);
    expect(remaining).toContain(fresh.id);
    expect(remaining).not.toContain(stale.id);
  });
});
