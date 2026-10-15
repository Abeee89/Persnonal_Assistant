import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDatabase, type DatabaseHandle } from "./client";
import { runMigrations, MIGRATIONS_FOLDER } from "./migrate";
import { DEFAULT_CATEGORIES, seedDefaultCategories } from "./seed";
import { activities, categories, goals, habitLogs, habits, journals, milestones, tasks } from "./schema";

const NOW = "2026-10-02T09:00:00.000Z";

let handle: DatabaseHandle;

function freshDb(): DatabaseHandle {
  const h = openDatabase({ file: ":memory:" });
  runMigrations(h.db);
  return h;
}

beforeEach(() => {
  handle = freshDb();
});

afterEach(() => {
  handle.close();
});

function insertActivity(overrides: Partial<typeof activities.$inferInsert> = {}) {
  handle.db
    .insert(activities)
    .values({
      id: "act-1",
      title: "Coding",
      date: "2026-10-02",
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    })
    .run();
}

describe("database bootstrap", () => {
  it("applies pragmas (foreign keys on, busy timeout set)", () => {
    expect(handle.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(handle.sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
  });

  it("uses WAL on file-backed databases", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-db-"));
    const file = path.join(dir, "test.db");
    const fileHandle = openDatabase({ file });
    try {
      runMigrations(fileHandle.db);
      expect(fileHandle.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    } finally {
      fileHandle.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates every MVP table from the migration", () => {
    const rows = handle.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' AND name NOT LIKE 'search_fts%'")
      .all() as { name: string }[];
    const names = rows.map((row) => row.name).sort();
    expect(names).toEqual(
      [
        "activities",
        "activity_tags",
        "attachments",
        "categories",
        "goal_tags",
        "goals",
        "habit_logs",
        "habits",
        "journal_tags",
        "journals",
        "meta",
        "milestones",
        "preferences",
        "tags",
        "task_tags",
        "tasks",
      ].sort(),
    );
  });

  it("is idempotent when migrations run twice", () => {
    expect(() => {
      runMigrations(handle.db);
      runMigrations(handle.db);
    }).not.toThrow();
  });

  it("ships migrations in the drizzle folder", () => {
    expect(fs.existsSync(path.join(MIGRATIONS_FOLDER, "0000_init.sql"))).toBe(true);
  });
});

describe("constraints", () => {
  it("rejects an invalid activity status", () => {
    expect(() => { insertActivity({ status: "bogus" }); }).toThrow(/CHECK constraint/);
  });

  it("rejects end time before start time", () => {
    expect(() => { insertActivity({ startTime: "10:00", endTime: "09:00" }); }).toThrow(/CHECK constraint/);
  });

  it("rejects mood outside 1..5", () => {
    expect(() => { insertActivity({ mood: 9 }); }).toThrow(/CHECK constraint/);
  });

  it("allows only one daily journal per date while alive", () => {
    const base = { type: "daily", createdAt: NOW, updatedAt: NOW, date: "2026-10-02" } as const;
    handle.db.insert(journals).values({ id: "j1", ...base }).run();
    expect(() => handle.db.insert(journals).values({ id: "j2", ...base }).run()).toThrow(/UNIQUE/);
  });

  it("allows a new daily journal after the previous one is soft-deleted", () => {
    const base = { type: "daily", createdAt: NOW, updatedAt: NOW, date: "2026-10-02" } as const;
    handle.db.insert(journals).values({ id: "j1", ...base, deletedAt: NOW }).run();
    expect(() => handle.db.insert(journals).values({ id: "j2", ...base }).run()).not.toThrow();
  });

  it("allows weekly and daily journals on the same date", () => {
    const base = { date: "2026-10-02", createdAt: NOW, updatedAt: NOW } as const;
    handle.db.insert(journals).values({ id: "d", type: "daily", ...base }).run();
    expect(() => handle.db.insert(journals).values({ id: "w", type: "weekly", ...base }).run()).not.toThrow();
  });

  it("enforces unique habit log per habit and date", () => {
    handle.db.insert(habits).values({ id: "h1", name: "Read", createdAt: NOW, updatedAt: NOW }).run();
    const log = { habitId: "h1", date: "2026-10-02", createdAt: NOW };
    handle.db.insert(habitLogs).values({ id: "l1", ...log }).run();
    expect(() => handle.db.insert(habitLogs).values({ id: "l2", ...log }).run()).toThrow(/UNIQUE/);
  });

  it("rejects manual progress above 100", () => {
    expect(() =>
      handle.db
        .insert(goals)
        .values({
          id: "g1",
          title: "Learn",
          progressMode: "manual",
          manualProgress: 120,
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run(),
    ).toThrow(/CHECK constraint/);
  });
});

describe("referential behaviour", () => {
  it("cascades milestones when a goal is hard-deleted", () => {
    handle.db.insert(goals).values({ id: "g1", title: "Learn", createdAt: NOW, updatedAt: NOW }).run();
    handle.db
      .insert(milestones)
      .values({ id: "m1", goalId: "g1", title: "Step", createdAt: NOW })
      .run();
    handle.db.delete(goals).where(eq(goals.id, "g1")).run();
    expect(handle.db.select().from(milestones).all()).toHaveLength(0);
  });

  it("nulls activity goal link when the goal is deleted", () => {
    handle.db.insert(goals).values({ id: "g1", title: "Learn", createdAt: NOW, updatedAt: NOW }).run();
    insertActivity({ goalId: "g1" });
    handle.db.delete(goals).where(eq(goals.id, "g1")).run();
    const row = handle.db.select().from(activities).where(eq(activities.id, "act-1")).get();
    expect(row?.goalId).toBeNull();
  });

  it("restricts deleting an activity that a task points at", () => {
    insertActivity();
    handle.db
      .insert(tasks)
      .values({ id: "t1", title: "Follow up", activityId: "act-1", createdAt: NOW, updatedAt: NOW })
      .run();
    expect(() => handle.db.delete(activities).where(eq(activities.id, "act-1")).run()).toThrow(/FOREIGN KEY/);
  });

  it("restricts deleting a category that is in use", () => {
    seedDefaultCategories(handle.db, () => NOW);
    insertActivity({ categoryId: "default-work" });
    expect(() => handle.db.delete(categories).where(eq(categories.id, "default-work")).run()).toThrow(/FOREIGN KEY/);
  });
});

describe("seedDefaultCategories", () => {
  it("inserts the seven SDD default categories on first run", () => {
    const inserted = seedDefaultCategories(handle.db, () => NOW);
    expect(inserted).toBe(DEFAULT_CATEGORIES.length);
    const rows = handle.db.select().from(categories).all();
    expect(rows.map((row) => row.slug).sort()).toEqual(
      ["exercise", "health", "other", "personal", "project", "study", "work"],
    );
    expect(rows.every((row) => row.isDefault)).toBe(true);
  });

  it("is idempotent: second run inserts nothing", () => {
    seedDefaultCategories(handle.db, () => NOW);
    expect(seedDefaultCategories(handle.db, () => NOW)).toBe(0);
    expect(handle.db.select().from(categories).all()).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("does not overwrite a user-edited default on re-seed", () => {
    seedDefaultCategories(handle.db, () => NOW);
    handle.db
      .update(categories)
      .set({ name: "Job" })
      .where(eq(categories.slug, "work"))
      .run();
    seedDefaultCategories(handle.db, () => NOW);
    const work = handle.db.select().from(categories).where(eq(categories.slug, "work")).get();
    expect(work?.name).toBe("Job");
  });
});
