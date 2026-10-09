import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";
import { eq } from "drizzle-orm";
import { activities, goals, tasks } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { taskInputSchema } from "@/schemas/task";
import { createTask, deleteTask, getTask, listTaskLanes, setTaskStatus, updateTask } from "./service";

const TODAY = "2026-10-10";
let handle: DatabaseHandle;
let db: Db;
let dir: string;
let counter = 0;
let clock = 0;

const iso = () => new Date(Date.UTC(2026, 9, 10, 9) + clock++ * 1000).toISOString();
const ctx = { now: iso, newId: () => `t${String(++counter).padStart(4, "0")}`, today: () => TODAY };

function task(overrides: Record<string, unknown> = {}) {
  return taskInputSchema.parse({ title: "Fix router bug", ...overrides });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-task-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  seedDefaultCategories(db, iso);
  counter = 0;
  clock = 0;
  db.insert(goals).values({ id: "goal-1", title: "Learn Next.js", createdAt: iso(), updatedAt: iso() }).run();
  db.insert(activities).values({ id: "act-1", title: "Standup", date: TODAY, createdAt: iso(), updatedAt: iso() }).run();
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("createTask", () => {
  it("creates an open task with a lane and no completion stamp", () => {
    const view = createTask(db, task({ dueDate: TODAY }), ctx);
    expect(view).toMatchObject({ status: "todo", lane: "today", completedAt: null });
  });

  it("stamps completedAt when created as done", () => {
    const view = createTask(db, task({ status: "done" }), ctx);
    expect(view.completedAt).not.toBeNull();
    expect(view.lane).toBe("done");
  });

  it("stores tags normalised and shows the linked goal title", () => {
    const view = createTask(db, task({ tags: ["Bug", "bug", "Frontend"], goalId: "goal-1" }), ctx);
    expect(view.tags).toEqual(["bug", "frontend"]);
    expect(view.goalTitle).toBe("Learn Next.js");
  });

  it("validates goal, activity and category references", () => {
    expect(() => createTask(db, task({ goalId: "missing" }), ctx)).toThrow(AppError);
    expect(() => createTask(db, task({ activityId: "missing" }), ctx)).toThrow(AppError);
    expect(() => createTask(db, task({ categoryId: "missing" }), ctx)).toThrow(AppError);
  });

  it("refuses to link an activity that was soft-deleted", () => {
    db.update(activities).set({ deletedAt: iso() }).run();
    expect(() => createTask(db, task({ activityId: "act-1" }), ctx)).toThrow(AppError);
  });
});

describe("completion rules", () => {
  it("completing sets completedAt and moves to the done lane", () => {
    const created = createTask(db, task({ dueDate: TODAY }), ctx);
    const done = setTaskStatus(db, created.id, "done", ctx);
    expect(done.completedAt).not.toBeNull();
    expect(done.lane).toBe("done");
  });

  it("reopening clears completedAt", () => {
    const created = createTask(db, task({ status: "done" }), ctx);
    const reopened = setTaskStatus(db, created.id, "todo", ctx);
    expect(reopened.completedAt).toBeNull();
    expect(reopened.lane).toBe("someday");
  });

  it("keeps the original completion time when already done and edited again", () => {
    const created = createTask(db, task({ status: "done" }), ctx);
    const again = updateTask(db, created.id, { title: "Renamed" }, ctx);
    expect(again.completedAt).toBe(created.completedAt);
  });

  it("cancelled tasks leave every lane but remain readable", () => {
    const created = createTask(db, task({ dueDate: TODAY }), ctx);
    const cancelled = setTaskStatus(db, created.id, "cancelled", ctx);
    expect(cancelled.lane).toBeNull();
    expect(getTask(db, created.id, TODAY).status).toBe("cancelled");
  });
});

describe("updateTask", () => {
  it("merges a partial patch and keeps untouched fields", () => {
    const created = createTask(db, task({ description: "Stack trace in logs", priority: "high" }), ctx);
    const updated = updateTask(db, created.id, { title: "Fix routing bug" }, ctx);
    expect(updated).toMatchObject({ title: "Fix routing bug", description: "Stack trace in logs", priority: "high" });
  });

  it("replaces tags only when they are patched", () => {
    const created = createTask(db, task({ tags: ["a"] }), ctx);
    expect(updateTask(db, created.id, { title: "x" }, ctx).tags).toEqual(["a"]);
    expect(updateTask(db, created.id, { tags: ["b"] }, ctx).tags).toEqual(["b"]);
  });

  it("validates the merged result", () => {
    const created = createTask(db, task(), ctx);
    expect(() => updateTask(db, created.id, { dueDate: "2026-02-31" }, ctx)).toThrow(AppError);
  });

  it("reports NOT_FOUND for unknown tasks", () => {
    expect(() => updateTask(db, "nope", { title: "x" }, ctx)).toThrow(/not found/i);
  });
});

describe("deleteTask and activity protection", () => {
  it("deletes a task", () => {
    const created = createTask(db, task(), ctx);
    deleteTask(db, created.id);
    expect(() => getTask(db, created.id, TODAY)).toThrow(/not found/i);
  });

  it("reports NOT_FOUND when deleting an unknown task", () => {
    expect(() => {
      deleteTask(db, "nope");
    }).toThrow(/not found/i);
  });

  it("blocks deleting an activity that a task points at (RESTRICT)", () => {
    createTask(db, task({ activityId: "act-1" }), ctx);
    expect(() => db.delete(activities).where(eq(activities.id, "act-1")).run()).toThrow(/FOREIGN KEY/);
  });
});

describe("listTaskLanes", () => {
  it("groups open and recently done tasks and sorts by due date", () => {
    createTask(db, task({ title: "Late", dueDate: "2026-10-03" }), ctx);
    createTask(db, task({ title: "Today A", dueDate: TODAY }), ctx);
    createTask(db, task({ title: "Week", dueDate: "2026-10-14" }), ctx);
    createTask(db, task({ title: "Someday" }), ctx);
    createTask(db, task({ title: "Done now", status: "done" }), ctx);
    createTask(db, task({ title: "Dropped", status: "cancelled", dueDate: TODAY }), ctx);

    const lanes = listTaskLanes(db, TODAY);
    expect(lanes.overdue.map((t) => t.title)).toEqual(["Late"]);
    expect(lanes.today.map((t) => t.title)).toEqual(["Today A"]);
    expect(lanes.week.map((t) => t.title)).toEqual(["Week"]);
    expect(lanes.someday.map((t) => t.title)).toEqual(["Someday"]);
    expect(lanes.done.map((t) => t.title)).toEqual(["Done now"]);
  });

  it("hides done tasks completed before yesterday", () => {
    const created = createTask(db, task({ status: "done" }), ctx);
    db.update(tasks).set({ completedAt: "2026-10-01T09:00:00.000Z" }).where(eq(tasks.id, created.id)).run();
    expect(listTaskLanes(db, TODAY).done).toEqual([]);
  });
});

