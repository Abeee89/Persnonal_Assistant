import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";
import { activities, habitLogs, habits, journals, tasks } from "@/db/schema";
import { windowFor } from "@/lib/domain/stats-window";
import { buildStats } from "./service";

const NOW = "2026-10-14T08:00:00.000Z";
let dir: string;
let handle: DatabaseHandle;
let db: Db;

const week = () => windowFor("week", "2026-10-14", 1); // 2026-10-12 .. 2026-10-18

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-stats-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  seedDefaultCategories(db, () => NOW);
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function activity(id: string, date: string, minutes: number, categoryId: string | null, status = "done") {
  db.insert(activities)
    .values({ id, title: id, date, durationMinutes: minutes, categoryId, status, createdAt: NOW, updatedAt: NOW })
    .run();
}

describe("buildStats", () => {
  it("is all zeros for an empty window", () => {
    const stats = buildStats(db, week());
    expect(stats).toMatchObject({
      activityCount: 0,
      totalMinutes: 0,
      productiveMinutes: 0,
      tasksDone: 0,
      tasksDue: 0,
      taskCompletionRate: 0,
      journalCount: 0,
      journaledDays: 0,
      habitConsistency: 0,
      averageMood: null,
      productivityScore: 0,
    });
    expect(stats.categoryMix).toEqual([]);
    expect(stats.moodPoints).toEqual([]);
  });

  it("counts activities and minutes only inside the window", () => {
    activity("a1", "2026-10-13", 90, "default-work");
    activity("a2", "2026-10-14", 30, null);
    activity("a3", "2026-10-20", 60, "default-work"); // next week
    const stats = buildStats(db, week());
    expect(stats.activityCount).toBe(2);
    expect(stats.totalMinutes).toBe(120);
  });

  it("counts productive time only for productive categories with a working status", () => {
    activity("work", "2026-10-13", 120, "default-work");
    activity("study", "2026-10-14", 60, "default-study", "in_progress");
    activity("personal", "2026-10-14", 45, "default-personal");
    activity("planned", "2026-10-14", 30, "default-work", "planned");
    const stats = buildStats(db, week());
    expect(stats.productiveMinutes).toBe(180);
    expect(stats.totalMinutes).toBe(255);
  });

  it("counts tasks completed inside the window and tasks due inside it", () => {
    db.insert(tasks)
      .values([
        { id: "t1", title: "Done in window", status: "done", completedAt: "2026-10-13T10:00:00.000Z", dueDate: "2026-10-13", createdAt: NOW, updatedAt: NOW },
        { id: "t2", title: "Done before", status: "done", completedAt: "2026-10-01T10:00:00.000Z", dueDate: "2026-10-14", createdAt: NOW, updatedAt: NOW },
        { id: "t3", title: "Open due", status: "todo", dueDate: "2026-10-15", createdAt: NOW, updatedAt: NOW },
        { id: "t4", title: "Cancelled", status: "cancelled", dueDate: "2026-10-16", createdAt: NOW, updatedAt: NOW },
      ])
      .run();
    const stats = buildStats(db, week());
    expect(stats.tasksDone).toBe(1);
    expect(stats.tasksDue).toBe(3);
    expect(stats.taskCompletionRate).toBe(33);
  });

  it("counts journal entries and distinct journaled days", () => {
    db.insert(journals)
      .values([
        { id: "j1", date: "2026-10-13", type: "daily", mood: 4, createdAt: NOW, updatedAt: NOW },
        { id: "j2", date: "2026-10-14", type: "daily", mood: 2, createdAt: NOW, updatedAt: NOW },
        { id: "j3", date: "2026-10-14", type: "weekly", createdAt: NOW, updatedAt: NOW },
      ])
      .run();
    const stats = buildStats(db, week());
    expect(stats.journalCount).toBe(2);
    expect(stats.journaledDays).toBe(2);
  });

  it("computes habit consistency against every daily habit in the window", () => {
    db.insert(habits).values([
      { id: "h1", name: "Read", frequency: "daily", createdAt: NOW, updatedAt: NOW },
      { id: "h2", name: "Walk", frequency: "daily", createdAt: NOW, updatedAt: NOW },
    ]).run();
    db.insert(habitLogs).values([
      { id: "l1", habitId: "h1", date: "2026-10-12", createdAt: NOW },
      { id: "l2", habitId: "h1", date: "2026-10-13", createdAt: NOW },
      { id: "l3", habitId: "h2", date: "2026-10-14", createdAt: NOW },
    ]).run();
    const stats = buildStats(db, week());
    expect(stats.habitsExpected).toBe(14); // 2 habits x 7 days
    expect(stats.habitsHit).toBe(3);
    expect(stats.habitConsistency).toBe(21);
  });

  it("does not count archived habits in the expected total", () => {
    db.insert(habits).values([
      { id: "h1", name: "Read", frequency: "daily", createdAt: NOW, updatedAt: NOW },
      { id: "h2", name: "Old", frequency: "daily", archived: true, createdAt: NOW, updatedAt: NOW },
    ]).run();
    expect(buildStats(db, week()).habitsExpected).toBe(7);
  });

  it("weighs a weekly target into the expected total", () => {
    db.insert(habits).values({ id: "h1", name: "Gym", frequency: "weekly", targetPerPeriod: 3, createdAt: NOW, updatedAt: NOW }).run();
    expect(buildStats(db, week()).habitsExpected).toBe(3);
  });

  it("summarises the category mix with counts and minutes", () => {
    activity("w1", "2026-10-13", 120, "default-work");
    activity("w2", "2026-10-14", 60, "default-work");
    activity("p1", "2026-10-14", 30, "default-personal");
    activity("n1", "2026-10-15", 15, null);
    const mix = buildStats(db, week()).categoryMix;
    expect(mix[0]).toMatchObject({ name: "Work", count: 2, minutes: 180 });
    expect(mix.map((slice) => slice.name)).toContain("Uncategorized");
  });

  it("builds a mood trend that skips days without a mood", () => {
    db.insert(journals)
      .values([
        { id: "j1", date: "2026-10-12", type: "daily", mood: 5, createdAt: NOW, updatedAt: NOW },
        { id: "j2", date: "2026-10-13", type: "daily", createdAt: NOW, updatedAt: NOW },
        { id: "j3", date: "2026-10-14", type: "daily", mood: 3, createdAt: NOW, updatedAt: NOW },
      ])
      .run();
    const stats = buildStats(db, week());
    expect(stats.moodPoints).toEqual([
      { day: "2026-10-12", mood: 5 },
      { day: "2026-10-14", mood: 3 },
    ]);
    expect(stats.averageMood).toBe(4);
  });

  it("scores a full week higher than an empty one", () => {
    const empty = buildStats(db, week()).productivityScore;
    db.insert(tasks).values({ id: "t1", title: "Done", status: "done", completedAt: "2026-10-14T10:00:00.000Z", dueDate: "2026-10-14", createdAt: NOW, updatedAt: NOW }).run();
    activity("a1", "2026-10-14", 60, "default-work");
    db.insert(journals).values({ id: "j1", date: "2026-10-14", type: "daily", contentPlain: "wrote", createdAt: NOW, updatedAt: NOW }).run();
    const busy = buildStats(db, week()).productivityScore;
    expect(empty).toBe(0);
    expect(busy).toBeGreaterThan(0);
    expect(busy).toBeLessThanOrEqual(100);
  });

  it("excludes soft-deleted activities and journals", () => {
    activity("a1", "2026-10-13", 90, "default-work");
    db.update(activities).set({ deletedAt: NOW }).run();
    db.insert(journals).values({ id: "j1", date: "2026-10-13", type: "daily", deletedAt: NOW, createdAt: NOW, updatedAt: NOW }).run();
    const stats = buildStats(db, week());
    expect(stats.activityCount).toBe(0);
    expect(stats.journalCount).toBe(0);
  });
});
