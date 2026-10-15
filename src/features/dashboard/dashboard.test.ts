import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { activities, goals, habitLogs, habits, journals, milestones, tasks } from "@/db/schema";
import { buildDashboard } from "./service";

const TODAY = "2026-10-14";
const NOW = `${TODAY}T08:00:00.000Z`;
let dir: string;
let handle: DatabaseHandle;
let db: Db;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-dash-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("buildDashboard", () => {
  it("is empty and calm for a brand-new database", () => {
    const snap = buildDashboard(db, TODAY);
    expect(snap).toMatchObject({
      activitiesToday: 0,
      tasks: { done: 0, total: 0, overdue: 0 },
      habits: { done: 0, total: 0 },
      goalAverage: null,
      activeGoals: 0,
      todayJournal: null,
      recentJournal: null,
      focus: "reflection",
      focusGoal: null,
    });
  });

  it("counts today's activities and lists them on the timeline in time order", () => {
    db.insert(activities)
      .values([
        { id: "a1", title: "Coding", date: TODAY, startTime: "15:00", endTime: "17:00", createdAt: NOW, updatedAt: NOW },
        { id: "a2", title: "Standup", date: TODAY, startTime: "09:00", endTime: "09:15", createdAt: NOW, updatedAt: NOW },
        { id: "a3", title: "Yesterday", date: "2026-10-13", createdAt: NOW, updatedAt: NOW },
      ])
      .run();
    const snap = buildDashboard(db, TODAY);
    expect(snap.activitiesToday).toBe(2);
    expect(snap.timeline.map((e) => e.title)).toEqual(["Standup", "Coding"]);
  });

  it("counts tasks due today as done/total, and open overdue tasks separately", () => {
    db.insert(tasks)
      .values([
        { id: "t1", title: "Ship", dueDate: TODAY, status: "done", completedAt: NOW, createdAt: NOW, updatedAt: NOW },
        { id: "t2", title: "Review", dueDate: TODAY, status: "todo", createdAt: NOW, updatedAt: NOW },
        { id: "t3", title: "Late", dueDate: "2026-10-10", status: "in_progress", createdAt: NOW, updatedAt: NOW },
        { id: "t4", title: "Dropped", dueDate: TODAY, status: "cancelled", createdAt: NOW, updatedAt: NOW },
      ])
      .run();
    const snap = buildDashboard(db, TODAY);
    expect(snap.tasks).toEqual({ done: 1, total: 2, overdue: 1 });
    expect(snap.focus).toBe("overdue");
  });

  it("reports habit progress for today and the check state of each habit", () => {
    db.insert(habits).values([
      { id: "h1", name: "Read", createdAt: NOW, updatedAt: NOW },
      { id: "h2", name: "Walk", createdAt: NOW, updatedAt: NOW },
    ]).run();
    db.insert(habitLogs).values({ id: "l1", habitId: "h1", date: TODAY, createdAt: NOW }).run();
    const snap = buildDashboard(db, TODAY);
    expect(snap.habits).toEqual({ done: 1, total: 2 });
  });

  it("averages active goal progress and ignores completed and archived goals", () => {
    db.insert(goals).values([
      { id: "g1", title: "Learn", status: "in_progress", createdAt: NOW, updatedAt: NOW },
      { id: "g2", title: "Done", status: "completed", createdAt: NOW, updatedAt: NOW },
      { id: "g3", title: "Old", status: "archived", createdAt: NOW, updatedAt: NOW },
    ]).run();
    db.insert(milestones).values([
      { id: "m1", goalId: "g1", title: "a", done: true, createdAt: NOW },
      { id: "m2", goalId: "g1", title: "b", done: false, createdAt: NOW },
    ]).run();
    const snap = buildDashboard(db, TODAY);
    expect(snap.goalAverage).toBe(50);
    expect(snap.activeGoals).toBe(1);
    expect(snap.focusGoal?.title).toBe("Learn");
  });

  it("uses today's journal to decide the focus card and shows the most recent earlier entry", () => {
    db.insert(journals).values([
      { id: "j0", date: "2026-10-12", type: "daily", contentPlain: "Earlier thoughts", createdAt: NOW, updatedAt: NOW },
      { id: "j1", date: TODAY, type: "daily", contentPlain: "Today", createdAt: NOW, updatedAt: NOW },
    ]).run();
    const snap = buildDashboard(db, TODAY);
    expect(snap.todayJournal?.preview).toBe("Today");
    expect(snap.recentJournal).toEqual({ date: "2026-10-12", preview: "Earlier thoughts" });
    expect(snap.focus).toBe("none");
  });

  it("does not show a weekly journal as today's entry", () => {
    db.insert(journals).values({ id: "w", date: TODAY, type: "weekly", createdAt: NOW, updatedAt: NOW }).run();
    expect(buildDashboard(db, TODAY).todayJournal).toBeNull();
  });
});
