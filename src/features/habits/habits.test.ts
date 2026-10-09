import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { habitInputSchema } from "@/schemas/habit";
import { AppError } from "@/lib/errors";
import {
  createHabit,
  deleteHabit,
  getHabit,
  heatmapFor,
  listHabits,
  setHabitArchived,
  toggleHabitLog,
  updateHabit,
} from "./service";

const TODAY = "2026-10-10";
let dir: string;
let handle: DatabaseHandle;
let db: Db;
let counter = 0;

const ctx = { now: () => `${TODAY}T08:00:00.000Z`, newId: () => `h${String(++counter).padStart(4, "0")}`, today: () => TODAY };

function habit(overrides: Record<string, unknown> = {}) {
  return habitInputSchema.parse({ name: "Read", ...overrides });
}

/** Creates a habit whose createdAt is the given day, so backfill rules are testable. */
function createdOn(day: string, overrides: Record<string, unknown> = {}) {
  const view = createHabit(db, habit(overrides), { ...ctx, now: () => `${day}T08:00:00.000Z` });
  return view;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-habit-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  counter = 0;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("createHabit / updateHabit", () => {
  it("creates a daily habit with no logs", () => {
    const view = createHabit(db, habit(), ctx);
    expect(view).toMatchObject({ name: "Read", frequency: "daily", doneToday: false, currentStreak: 0, bestStreak: 0 });
  });

  it("rejects a weekly target above 7 at the schema boundary", () => {
    expect(habitInputSchema.safeParse({ name: "Gym", frequency: "weekly", targetPerPeriod: 9 }).success).toBe(false);
  });

  it("updates fields with a merged, re-validated patch", () => {
    const created = createHabit(db, habit({ frequency: "weekly", targetPerPeriod: 3 }), ctx);
    expect(() => updateHabit(db, created.id, { frequency: "daily" }, ctx)).toThrow(AppError);
    const renamed = updateHabit(db, created.id, { name: "Gym" }, ctx);
    expect(renamed).toMatchObject({ name: "Gym", frequency: "weekly", targetPerPeriod: 3 });
  });

  it("reports NOT_FOUND for unknown habits", () => {
    expect(() => getHabit(db, "nope", TODAY)).toThrow(/not found/i);
    expect(() => updateHabit(db, "nope", { name: "x" }, ctx)).toThrow(/not found/i);
  });
});

describe("toggleHabitLog", () => {
  it("checks today and updates streak, strip and done flag", () => {
    const h = createdOn("2026-10-01");
    const result = toggleHabitLog(db, { habitId: h.id, date: TODAY }, ctx);
    expect(result.done).toBe(true);
    expect(result.habit).toMatchObject({ doneToday: true, currentStreak: 1, periodCount: 1 });
  });

  it("unchecks on a second toggle", () => {
    const h = createdOn("2026-10-01");
    toggleHabitLog(db, { habitId: h.id, date: TODAY }, ctx);
    const undone = toggleHabitLog(db, { habitId: h.id, date: TODAY }, ctx);
    expect(undone.done).toBe(false);
    expect(undone.habit.currentStreak).toBe(0);
  });

  it("returns the server truth when the expected state is stale", () => {
    const h = createdOn("2026-10-01");
    toggleHabitLog(db, { habitId: h.id, date: TODAY }, ctx);
    const stale = toggleHabitLog(db, { habitId: h.id, date: TODAY, expectedDone: false }, ctx);
    expect(stale.done).toBe(true);
    expect(stale.habit.doneToday).toBe(true);
  });

  it("applies the toggle when the expected state matches", () => {
    const h = createdOn("2026-10-01");
    const result = toggleHabitLog(db, { habitId: h.id, date: TODAY, expectedDone: false }, ctx);
    expect(result.done).toBe(true);
  });

  it("allows backfilling a missed earlier day", () => {
    const h = createdOn("2026-10-01");
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-08" }, ctx);
    const view = getHabit(db, h.id, TODAY);
    expect(view.logDates).toContain("2026-10-08");
    expect(view.doneToday).toBe(false);
  });

  it("refuses future days", () => {
    const h = createdOn("2026-10-01");
    expect(() => toggleHabitLog(db, { habitId: h.id, date: "2026-10-11" }, ctx)).toThrow(AppError);
  });

  it("refuses days before the habit existed", () => {
    const h = createdOn("2026-10-05");
    expect(() => toggleHabitLog(db, { habitId: h.id, date: "2026-10-04" }, ctx)).toThrow(/did not exist/);
  });

  it("builds a streak across consecutive days and resets after a gap", () => {
    const h = createdOn("2026-10-01");
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-07" }, ctx);
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-08" }, ctx);
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-09" }, ctx);
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-10" }, ctx);
    expect(getHabit(db, h.id, TODAY)).toMatchObject({ currentStreak: 4, bestStreak: 4 });
    const broken = createdOn("2026-09-01", { name: "Gym" });
    toggleHabitLog(db, { habitId: broken.id, date: "2026-10-01" }, ctx);
    toggleHabitLog(db, { habitId: broken.id, date: "2026-10-05" }, ctx);
    expect(getHabit(db, broken.id, TODAY)).toMatchObject({ currentStreak: 0, bestStreak: 1 });
  });

  it("weekly habit: a week below target is shown as partial, not missed", () => {
    const h = createdOn("2026-10-01", { frequency: "weekly", targetPerPeriod: 3 });
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-05" }, ctx);
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-06" }, ctx);
    const view = getHabit(db, h.id, TODAY);
    expect(view.periodCount).toBe(2);
    expect(view.periodTarget).toBe(3);
    expect(view.currentStreak).toBe(0);
  });
});

describe("lists, archive, delete, heatmap", () => {
  it("hides archived habits from the default list", () => {
    const h = createdOn("2026-10-01");
    setHabitArchived(db, h.id, true, ctx);
    expect(listHabits(db, TODAY, false)).toHaveLength(0);
    expect(listHabits(db, TODAY, true)).toHaveLength(1);
  });

  it("deletes a habit and its logs", () => {
    const h = createdOn("2026-10-01");
    toggleHabitLog(db, { habitId: h.id, date: TODAY }, ctx);
    deleteHabit(db, h.id);
    const logs = (handle.sqlite.prepare("SELECT count(*) AS n FROM habit_logs").get() as { n: number }).n;
    expect(logs).toBe(0);
  });

  it("heatmap has 365 cells ending today and marks logged days", () => {
    const h = createdOn("2026-01-01");
    toggleHabitLog(db, { habitId: h.id, date: "2026-10-10" }, ctx);
    const cells = heatmapFor(db, h.id, TODAY);
    expect(cells).toHaveLength(365);
    expect(cells[cells.length - 1]).toEqual({ day: TODAY, done: true });
    expect(cells.filter((c) => c.done)).toHaveLength(1);
  });
});
