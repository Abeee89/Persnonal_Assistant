import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";
import { activityInputSchema, activityListQuerySchema, type ActivityListQuery } from "@/schemas/activity";
import { AppError } from "@/lib/errors";
import {
  createActivity,
  decodeCursor,
  deleteActivity,
  deriveTiming,
  duplicateActivity,
  encodeCursor,
  getActivity,
  listActivities,
  restoreActivity,
  setActivityStatus,
  updateActivity,
} from "./service";

let tmpDir: string;
let handle: DatabaseHandle;
let db: Db;
let clock = 0;

const now = () => new Date(Date.UTC(2026, 9, 2, 9, 0, 0) + clock++).toISOString();
let idCounter = 0;
const newId = () => `id-${String(++idCounter).padStart(6, "0")}`;
const ctx = { now, newId };

function input(overrides: Record<string, unknown> = {}) {
  return activityInputSchema.parse({ title: "Coding", date: "2026-10-02", ...overrides });
}

function list(overrides: Partial<ActivityListQuery> = {}) {
  return listActivities(db, activityListQuerySchema.parse(overrides));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-act-"));
  handle = openDatabase({ file: path.join(tmpDir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  clock = 0;
  idCounter = 0;
  seedDefaultCategories(handle.db, () => now());
});

afterEach(() => {
  handle.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createActivity", () => {
  it("stores a timed activity with derived duration and ordering epoch", () => {
    const view = createActivity(db, input({ startTime: "15:00", endTime: "17:30", categoryId: "default-work" }), ctx);
    expect(view.durationMinutes).toBe(150);
    expect(view.startTime).toBe("15:00");
    expect(view.categoryId).toBe("default-work");
    const row = handle.sqlite
      .prepare("SELECT start_epoch FROM activities WHERE id = ?")
      .get(view.id) as { start_epoch: number };
    expect(row.start_epoch).toBe(new Date("2026-10-02T15:00:00").getTime());
  });

  it("stores tags normalised and reuses existing tag rows", () => {
    createActivity(db, input({ tags: ["Deepwork", "client-x"] }), ctx);
    const second = createActivity(db, input({ title: "Review", tags: ["deepwork"] }), ctx);
    expect(second.tags).toEqual(["deepwork"]);
    const tagCount = (handle.sqlite.prepare("SELECT count(*) AS n FROM tags").get() as { n: number }).n;
    expect(tagCount).toBe(2);
  });

  it("rejects an unknown category with a field error", () => {
    try {
      createActivity(db, input({ categoryId: "nope" }), ctx);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).fieldErrors).toHaveProperty("categoryId");
    }
  });

  it("rejects a goal that does not exist", () => {
    expect(() => createActivity(db, input({ goalId: "missing-goal" }), ctx)).toThrow(AppError);
  });
});

describe("updateActivity", () => {
  it("merges a partial patch and keeps untouched fields", () => {
    const created = createActivity(db, input({ title: "Draft", location: "Office" }), ctx);
    const updated = updateActivity(db, created.id, { status: "done" }, ctx);
    expect(updated.status).toBe("done");
    expect(updated.title).toBe("Draft");
    expect(updated.location).toBe("Office");
  });

  it("re-derives duration when times change", () => {
    const created = createActivity(db, input({ startTime: "09:00", endTime: "10:00" }), ctx);
    const updated = updateActivity(db, created.id, { endTime: "11:15" }, ctx);
    expect(updated.durationMinutes).toBe(135);
  });

  it("validates the merged result (end before start is rejected)", () => {
    const created = createActivity(db, input({ startTime: "09:00", endTime: "10:00" }), ctx);
    expect(() => updateActivity(db, created.id, { endTime: "08:00" }, ctx)).toThrow(AppError);
  });

  it("replaces tags only when tags are provided", () => {
    const created = createActivity(db, input({ tags: ["a"] }), ctx);
    expect(updateActivity(db, created.id, { title: "Renamed" }, ctx).tags).toEqual(["a"]);
    expect(updateActivity(db, created.id, { tags: ["b"] }, ctx).tags).toEqual(["b"]);
  });

  it("returns NOT_FOUND for unknown ids", () => {
    expect(() => updateActivity(db, "nope", { title: "x" }, ctx)).toThrow(/not found/i);
  });
});

describe("status, duplicate, delete, restore", () => {
  it("sets status", () => {
    const created = createActivity(db, input(), ctx);
    expect(setActivityStatus(db, created.id, "in_progress", ctx).status).toBe("in_progress");
  });

  it("duplicates to another day without times and links the source", () => {
    const source = createActivity(db, input({ startTime: "08:00", endTime: "09:00", tags: ["x"], status: "done" }), ctx);
    const copy = duplicateActivity(db, source.id, "2026-10-05", ctx);
    expect(copy.id).not.toBe(source.id);
    expect(copy.date).toBe("2026-10-05");
    expect(copy.startTime).toBeNull();
    expect(copy.status).toBe("planned");
    expect(copy.sourceActivityId).toBe(source.id);
    expect(copy.tags).toEqual(["x"]);
  });

  it("soft-deletes so the row disappears from reads but stays in the table", () => {
    const created = createActivity(db, input(), ctx);
    deleteActivity(db, created.id, ctx);
    expect(() => getActivity(db, created.id)).toThrow(/not found/i);
    const raw = handle.sqlite
      .prepare("SELECT deleted_at FROM activities WHERE id = ?")
      .get(created.id) as { deleted_at: string | null };
    expect(raw.deleted_at).not.toBeNull();
  });

  it("restores a soft-deleted activity", () => {
    const created = createActivity(db, input(), ctx);
    deleteActivity(db, created.id, ctx);
    expect(restoreActivity(db, created.id, ctx).id).toBe(created.id);
  });

  it("refuses to restore a live activity", () => {
    const created = createActivity(db, input(), ctx);
    expect(() => restoreActivity(db, created.id, ctx)).toThrow(/not found/i);
  });
});

describe("listActivities", () => {
  beforeEach(() => {
    createActivity(db, input({ title: "Morning run", date: "2026-10-01", categoryId: "default-exercise", status: "done" }), ctx);
    createActivity(db, input({ title: "Coding", date: "2026-10-02", categoryId: "default-work", startTime: "15:00", endTime: "17:00" }), ctx);
    createActivity(db, input({ title: "Study Next.js", date: "2026-10-02", categoryId: "default-study", description: "App router notes" }), ctx);
    createActivity(db, input({ title: "Groceries", date: "2026-10-03", categoryId: "default-personal" }), ctx);
  });

  it("orders newest first by default and pages with a keyset cursor", () => {
    const first = list({ limit: 2 });
    expect(first.items.map((item) => item.title)).toEqual(["Groceries", "Study Next.js"]);
    expect(first.nextCursor).not.toBeNull();
    const second = list({ limit: 2, cursor: first.nextCursor });
    expect(second.items.map((item) => item.title)).toEqual(["Coding", "Morning run"]);
    expect(second.nextCursor).toBeNull();
  });

  it("filters by day range", () => {
    expect(list({ from: "2026-10-02", to: "2026-10-02" }).items).toHaveLength(2);
  });

  it("filters by category and status", () => {
    expect(list({ categoryId: "default-work" }).items.map((i) => i.title)).toEqual(["Coding"]);
    expect(list({ status: "done" }).items.map((i) => i.title)).toEqual(["Morning run"]);
  });

  it("searches title and notes case-insensitively", () => {
    expect(list({ q: "NEXT.JS" }).items.map((i) => i.title)).toEqual(["Study Next.js"]);
    expect(list({ q: "app router" }).items.map((i) => i.title)).toEqual(["Study Next.js"]);
  });

  it("excludes soft-deleted rows", () => {
    const target = list({ q: "Groceries" }).items[0];
    if (!target) {
      throw new Error("seed row missing");
    }
    deleteActivity(db, target.id, ctx);
    expect(list({ q: "Groceries" }).items).toHaveLength(0);
  });

  it("returns tags for each item in one batch", () => {
    createActivity(db, input({ title: "Tagged", date: "2026-10-04", tags: ["alpha", "beta"] }), ctx);
    const tagged = list({ q: "Tagged" }).items[0];
    expect(tagged?.tags).toEqual(["alpha", "beta"]);
  });

  it("sorts ascending when requested", () => {
    expect(list({ sort: "date_asc", limit: 1 }).items[0]?.title).toBe("Morning run");
  });
});

describe("cursor", () => {
  it("round-trips and rejects tampered values", () => {
    const cursor = encodeCursor("2026-10-02", "abc");
    expect(decodeCursor(cursor)).toEqual({ date: "2026-10-02", id: "abc" });
    expect(() => decodeCursor("garbage")).toThrow(AppError);
    expect(() => decodeCursor(encodeCursor("2026-10-02", "a|b"))).toThrow(AppError);
  });
});

describe("deriveTiming", () => {
  it("returns no duration or epoch for all-day or untimed activities", () => {
    expect(deriveTiming({ date: "2026-10-02", startTime: null, endTime: null, allDay: true })).toEqual({
      durationMinutes: null,
      startEpoch: null,
    });
    expect(deriveTiming({ date: "2026-10-02", startTime: null, endTime: null, allDay: false })).toEqual({
      durationMinutes: null,
      startEpoch: null,
    });
  });

  it("keeps the start epoch for a start-only activity", () => {
    const timing = deriveTiming({ date: "2026-10-02", startTime: "09:00", endTime: null, allDay: false });
    expect(timing.durationMinutes).toBeNull();
    expect(timing.startEpoch).toBe(new Date("2026-10-02T09:00:00").getTime());
  });
});
