import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";
import { MemoryStorage } from "@/lib/storage/memory";
import { windowFor } from "@/lib/domain/stats-window";
import { localIsoDay } from "@/lib/domain/dates";

import { createActivity, getActivity, listActivities } from "@/features/activities/service";
import { saveDailyEntry, getDailyEntry } from "@/features/journal/service";
import { createTask, listTaskLanes, setTaskStatus } from "@/features/tasks/service";
import { addMilestone, createGoal, toggleMilestone } from "@/features/goals/service";
import { createHabit, getHabit, toggleHabitLog } from "@/features/habits/service";
import { search } from "@/features/search/service";
import { buildStats } from "@/features/statistics/service";
import { buildDashboard } from "@/features/dashboard/service";
import { applyImport, exportZipArchive, parseArchive, rawClient } from "@/features/backup/service";
import { activityInputSchema } from "@/schemas/activity";
import { journalUpsertSchema } from "@/schemas/journal";
import { taskInputSchema } from "@/schemas/task";
import { goalInputSchema, milestoneInputSchema } from "@/schemas/goal";
import { habitInputSchema } from "@/schemas/habit";

/**
 * The full product journey exercised through the service layer, without a browser.
 * This is the deterministic backstop for the Playwright run: it proves the features
 * compose (activity, journal, task, goal, habit, search, stats, backup) and that a
 * wipe-and-restore returns the same data.
 */
const TODAY = localIsoDay();
let dir: string;
let handle: DatabaseHandle;
let db: Db;
let storage: MemoryStorage;
let clock = 0;
let counter = 0;

const now = () => new Date(Date.parse(`${TODAY}T08:00:00Z`) + clock++ * 1000).toISOString();
const newId = () => `j${String(++counter).padStart(4, "0")}`;
const ctx = { now, newId };

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-journey-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  storage = new MemoryStorage();
  seedDefaultCategories(db, now);
});

afterAll(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("full journey", () => {
  it("logs an activity that shows in lists, search and stats", () => {
    const activity = createActivity(
      db,
      activityInputSchema.parse({
        title: "Build Next.js dashboard",
        date: TODAY,
        startTime: "15:00",
        endTime: "17:00",
        categoryId: "default-work",
        status: "done",
        tags: ["deepwork"],
      }),
      ctx,
    );
    expect(activity.durationMinutes).toBe(120);
    expect(getActivity(db, activity.id).title).toBe("Build Next.js dashboard");

    const page = listActivities(db, { sort: "date_desc", limit: 50, from: null, to: null, categoryId: null, status: null, priority: null, q: null, cursor: null });
    expect(page.items.map((item) => item.title)).toContain("Build Next.js dashboard");

    expect(search(db, "dashboard").some((hit) => hit.kind === "activity")).toBe(true);
  });

  it("writes a daily journal entry that is searchable by its text and tags", () => {
    const entry = saveDailyEntry(
      db,
      journalUpsertSchema.parse({
        date: TODAY,
        mood: 4,
        contentJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped the backup feature" }] }] }),
        tags: ["reflection"],
      }),
      ctx,
    );
    expect(getDailyEntry(db, TODAY)?.id).toBe(entry.id);
    expect(search(db, "backup").some((hit) => hit.kind === "journal")).toBe(true);
    expect(search(db, "reflection").some((hit) => hit.kind === "journal")).toBe(true);
  });

  it("adds a task that appears in today's lane and can be completed", () => {
    const task = createTask(db, taskInputSchema.parse({ title: "Review roadmap", dueDate: TODAY }), ctx);
    expect(listTaskLanes(db, TODAY).today.map((t) => t.id)).toContain(task.id);
    const done = setTaskStatus(db, task.id, "done", ctx);
    expect(done.lane).toBe("done");
    expect(done.completedAt).not.toBeNull();
  });

  it("creates a goal whose progress tracks its milestones", () => {
    const goal = createGoal(db, goalInputSchema.parse({ title: "Learn Next.js", startDate: TODAY, deadline: "2026-12-31" }), ctx);
    const withOne = addMilestone(db, milestoneInputSchema.parse({ goalId: goal.id, title: "App Router" }), ctx);
    const [first] = withOne.milestones;
    expect(first).toBeDefined();
    addMilestone(db, milestoneInputSchema.parse({ goalId: goal.id, title: "Server Actions" }), ctx);
    const half = toggleMilestone(db, first?.id ?? "", true, ctx);
    expect(half.progress).toBe(50);
  });

  it("tracks a habit and builds a streak", () => {
    const habit = createHabit(db, habitInputSchema.parse({ name: "Read", frequency: "daily" }), ctx);
    toggleHabitLog(db, { habitId: habit.id, date: TODAY }, ctx);
    expect(getHabit(db, habit.id, TODAY).currentStreak).toBe(1);
  });

  it("reflects everything on the dashboard and in statistics", () => {
    const dashboard = buildDashboard(db, TODAY);
    expect(dashboard.activitiesToday).toBeGreaterThanOrEqual(1);
    expect(dashboard.focus).toBe("goal"); // reflection written, nothing overdue, one goal still open
    const stats = buildStats(db, windowFor("week", TODAY, 1));
    expect(stats.activityCount).toBeGreaterThanOrEqual(1);
    expect(stats.productivityScore).toBeGreaterThan(0);
  });

  it("survives a full backup, wipe and restore", async () => {
    const before = {
      activities: countOf("activities"),
      journals: countOf("journals"),
      tasks: countOf("tasks"),
      goals: countOf("goals"),
      milestones: countOf("milestones"),
      habits: countOf("habits"),
      habitLogs: countOf("habit_logs"),
    };

    const zip = await exportZipArchive(rawClient(db), storage, now());

    // Wipe everything the way a replace-restore would, then confirm it is gone.
    const empty = parseArchive(zip);
    await applyImport(rawClient(db), storage, { ...empty, envelope: { schemaVersion: 1, tables: emptyTables() } }, "replace");
    expect(countOf("activities")).toBe(0);
    expect(countOf("journals")).toBe(0);

    const report = await applyImport(rawClient(db), storage, parseArchive(zip), "replace");
    expect(report.strategy).toBe("replace");
    expect({
      activities: countOf("activities"),
      journals: countOf("journals"),
      tasks: countOf("tasks"),
      goals: countOf("goals"),
      milestones: countOf("milestones"),
      habits: countOf("habits"),
      habitLogs: countOf("habit_logs"),
    }).toEqual(before);

    // Search still works after the restore, proving the FTS index was rebuilt by the triggers.
    expect(search(db, "dashboard").some((hit) => hit.kind === "activity")).toBe(true);
  });
});

function countOf(table: string): number {
  return (rawClient(db).prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}

function emptyTables(): Record<string, Record<string, unknown>[]> {
  const names = rawClient(db)
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_fts%' AND name NOT LIKE '__drizzle%'")
    .all() as { name: string }[];
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const { name } of names) {
    if (name !== "meta") {
      tables[name] = [];
    }
  }
  return tables;
}
