import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { journalUpsertSchema, type JournalUpsertInput } from "@/schemas/journal";
import { AppError } from "@/lib/errors";
import {
  deleteEntry,
  finalizeDailyEntry,
  getDailyEntry,
  getEntryById,
  listMonth,
  saveDailyEntry,
  templateFor,
} from "./service";

let tmpDir: string;
let handle: DatabaseHandle;
let db: Db;
let clock = 0;
let idCounter = 0;

const now = () => new Date(Date.UTC(2026, 9, 2, 9, 0, 0) + clock++ * 1000).toISOString();
const newId = () => `jid-${String(++idCounter).padStart(4, "0")}`;
const ctx = { now, newId };

const docWith = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

function entry(overrides: Partial<Record<string, unknown>> = {}): JournalUpsertInput {
  return journalUpsertSchema.parse({ date: "2026-10-02", contentJson: docWith("Today I learned Next.js"), ...overrides });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-jour-"));
  handle = openDatabase({ file: path.join(tmpDir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  clock = 0;
  idCounter = 0;
});

afterEach(() => {
  handle.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("saveDailyEntry (autosave upsert)", () => {
  it("creates one entry and extracts plain text for search", () => {
    const saved = saveDailyEntry(db, entry(), ctx);
    expect(saved.contentPlain).toBe("Today I learned Next.js");
    expect(saved.status).toBe("draft");
  });

  it("repeated saves for the same date update the same row (no duplicates)", () => {
    const first = saveDailyEntry(db, entry(), ctx);
    const second = saveDailyEntry(db, entry({ contentJson: docWith("Edited text") }), ctx);
    expect(second.id).toBe(first.id);
    expect(second.contentPlain).toBe("Edited text");
    const count = (handle.sqlite.prepare("SELECT count(*) AS n FROM journals").get() as { n: number }).n;
    expect(count).toBe(1);
  });

  it("keeps the user's prompt answers and mood", () => {
    saveDailyEntry(db, entry({ accomplished: "Shipped step 6", mood: 4, energyLevel: 3 }), ctx);
    const view = getDailyEntry(db, "2026-10-02");
    expect(view).toMatchObject({ accomplished: "Shipped step 6", mood: 4, energyLevel: 3 });
  });

  it("stores tags and replaces them on the next save", () => {
    saveDailyEntry(db, entry({ tags: ["Reflection", "work"] }), ctx);
    expect(getDailyEntry(db, "2026-10-02")?.tags).toEqual(["reflection", "work"]);
    saveDailyEntry(db, entry({ tags: ["health"] }), ctx);
    expect(getDailyEntry(db, "2026-10-02")?.tags).toEqual(["health"]);
  });

  it("allows different dates to have separate entries", () => {
    saveDailyEntry(db, entry({ date: "2026-10-02" }), ctx);
    saveDailyEntry(db, entry({ date: "2026-10-03" }), ctx);
    expect(getDailyEntry(db, "2026-10-03")).not.toBeNull();
    expect(listMonth(db, "2026-10")).toHaveLength(2);
  });
});

describe("getDailyEntry / templateFor", () => {
  it("returns null when a date has no entry", () => {
    expect(getDailyEntry(db, "2026-10-05")).toBeNull();
  });

  it("template is empty and has no id, so nothing is persisted by viewing", () => {
    const template = templateFor("2026-10-05");
    expect(template.id).toBe("");
    expect(template.contentPlain).toBe("");
    const count = (handle.sqlite.prepare("SELECT count(*) AS n FROM journals").get() as { n: number }).n;
    expect(count).toBe(0);
  });
});

describe("finalize and delete", () => {
  it("marks an entry final", () => {
    const saved = saveDailyEntry(db, entry(), ctx);
    expect(finalizeDailyEntry(db, saved.id, ctx).status).toBe("final");
  });

  it("soft-deletes so the entry no longer resolves", () => {
    const saved = saveDailyEntry(db, entry(), ctx);
    deleteEntry(db, saved.id, ctx);
    expect(getEntryById(db, saved.id)).toBeNull();
    expect(getDailyEntry(db, "2026-10-02")).toBeNull();
  });

  it("allows a fresh entry on the same date after deletion", () => {
    const first = saveDailyEntry(db, entry(), ctx);
    deleteEntry(db, first.id, ctx);
    const next = saveDailyEntry(db, entry({ contentJson: docWith("Fresh start") }), ctx);
    expect(next.id).not.toBe(first.id);
    expect(next.contentPlain).toBe("Fresh start");
  });

  it("rejects finalize or delete of an unknown entry", () => {
    expect(() => finalizeDailyEntry(db, "missing", ctx)).toThrow(AppError);
    expect(() => {
      deleteEntry(db, "missing", ctx);
    }).toThrow(AppError);
  });
});

describe("listMonth", () => {
  it("lists only the requested month, newest first, with a short preview", () => {
    saveDailyEntry(db, entry({ date: "2026-09-30", contentJson: docWith("September") }), ctx);
    saveDailyEntry(db, entry({ date: "2026-10-01", contentJson: docWith("First") }), ctx);
    saveDailyEntry(db, entry({ date: "2026-10-15", contentJson: docWith("Mid") }), ctx);
    const rows = listMonth(db, "2026-10");
    expect(rows.map((r) => r.date)).toEqual(["2026-10-15", "2026-10-01"]);
    expect(rows[0]?.preview).toBe("Mid");
  });

  it("excludes soft-deleted entries", () => {
    const saved = saveDailyEntry(db, entry({ date: "2026-10-04" }), ctx);
    deleteEntry(db, saved.id, ctx);
    expect(listMonth(db, "2026-10")).toHaveLength(0);
  });

  it("rejects a malformed month", () => {
    expect(() => listMonth(db, "2026-1")).toThrow(AppError);
  });
});
