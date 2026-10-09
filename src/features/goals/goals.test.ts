import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { activities, tasks } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { goalInputSchema, milestoneInputSchema } from "@/schemas/goal";
import {
  addMilestone,
  createGoal,
  deleteMilestone,
  getGoal,
  listGoals,
  softDeleteGoal,
  toggleMilestone,
  updateGoal,
} from "./service";

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`fixture missing at index ${String(index)}`);
  }
  return item;
}

let dir: string;
let handle: DatabaseHandle;
let db: Db;
let counter = 0;
let clock = 0;

const iso = () => new Date(Date.UTC(2026, 9, 1, 9) + clock++ * 1000).toISOString();
const ctx = { now: iso, newId: () => `g${String(++counter).padStart(4, "0")}` };

function goal(overrides: Record<string, unknown> = {}) {
  return goalInputSchema.parse({ title: "Learn Next.js", startDate: "2026-10-01", deadline: "2026-12-31", ...overrides });
}

function milestone(goalId: string, title: string) {
  return milestoneInputSchema.parse({ goalId, title });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-goal-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  counter = 0;
  clock = 0;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("createGoal", () => {
  it("creates a goal with zero progress and no milestones", () => {
    const view = createGoal(db, goal(), ctx);
    expect(view).toMatchObject({ progress: 0, status: "not_started", milestones: [], progressMode: "auto" });
  });

  it("rejects a deadline before the start date", () => {
    expect(() => goalInputSchema.parse({ title: "x", startDate: "2026-10-05", deadline: "2026-10-01" })).toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() => createGoal(db, goal({ categoryId: "nope" }), ctx)).toThrow(AppError);
  });

  it("stores tags normalised", () => {
    expect(createGoal(db, goal({ tags: ["Learning", "learning"] }), ctx).tags).toEqual(["learning"]);
  });
});

describe("milestones and automatic progress", () => {
  it("computes progress from completed milestones", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "Learn App Router"), ctx);
    addMilestone(db, milestone(g.id, "Learn Server Actions"), ctx);
    addMilestone(db, milestone(g.id, "Build project"), ctx);
    let view = getGoal(db, g.id);
    view = toggleMilestone(db, at(view.milestones, 0).id, true, ctx);
    expect(view.progress).toBe(33);
  });

  it("moves a not-started goal to in_progress on the first completed milestone", () => {
    const g = createGoal(db, goal(), ctx);
    const withMs = addMilestone(db, milestone(g.id, "Step"), ctx);
    expect(withMs.status).toBe("not_started");
    const after = toggleMilestone(db, at(withMs.milestones, 0).id, true, ctx);
    expect(after.status).toBe("completed");
  });

  it("completes the goal when every milestone is done and reopens when one is unchecked", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "A"), ctx);
    const view = addMilestone(db, milestone(g.id, "B"), ctx);
    toggleMilestone(db, at(view.milestones, 0).id, true, ctx);
    const finished = toggleMilestone(db, at(view.milestones, 1).id, true, ctx);
    expect(finished).toMatchObject({ progress: 100, status: "completed" });
    const reopened = toggleMilestone(db, at(finished.milestones, 1).id, false, ctx);
    expect(reopened).toMatchObject({ progress: 50, status: "in_progress" });
  });

  it("deleting a milestone recalculates progress and status", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "A"), ctx);
    const view = addMilestone(db, milestone(g.id, "B"), ctx);
    toggleMilestone(db, at(view.milestones, 0).id, true, ctx);
    const after = deleteMilestone(db, at(view.milestones, 0).id, ctx);
    expect(after.progress).toBe(0);
    expect(after.milestones).toHaveLength(1);
  });

  it("assigns increasing sort order to new milestones", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "first"), ctx);
    const view = addMilestone(db, milestone(g.id, "second"), ctx);
    expect(view.milestones.map((m) => m.sortOrder)).toEqual([0, 1]);
  });

  it("reports NOT_FOUND for an unknown milestone", () => {
    expect(() => toggleMilestone(db, "nope", true, ctx)).toThrow(/not found/i);
  });
});

describe("manual progress", () => {
  it("uses the stored value and ignores milestones", () => {
    const g = createGoal(db, goal({ progressMode: "manual", manualProgress: 65 }), ctx);
    const view = addMilestone(db, milestone(g.id, "A"), ctx);
    expect(view.progress).toBe(65);
    const done = toggleMilestone(db, at(view.milestones, 0).id, true, ctx);
    expect(done.progress).toBe(65);
  });

  it("switching a goal to auto mode returns progress to the milestone ratio", () => {
    const g = createGoal(db, goal({ progressMode: "manual", manualProgress: 65 }), ctx);
    const withMs = addMilestone(db, milestone(g.id, "A"), ctx);
    toggleMilestone(db, at(withMs.milestones, 0).id, true, ctx);
    const switched = updateGoal(db, g.id, { progressMode: "auto", manualProgress: null }, ctx);
    expect(switched.progress).toBe(100);
  });

  it("manual mode requires a value", () => {
    expect(() => goalInputSchema.parse({ title: "x", progressMode: "manual" })).toThrow();
  });
});

describe("updateGoal", () => {
  it("merges a patch and keeps untouched fields", () => {
    const g = createGoal(db, goal({ description: "Build a dashboard" }), ctx);
    const updated = updateGoal(db, g.id, { title: "Learn Next.js well" }, ctx);
    expect(updated).toMatchObject({ title: "Learn Next.js well", description: "Build a dashboard" });
  });

  it("re-validates the merged dates (deadline cannot move before start)", () => {
    const g = createGoal(db, goal(), ctx);
    expect(() => updateGoal(db, g.id, { deadline: "2026-09-01" }, ctx)).toThrow(AppError);
  });

  it("archive is respected by auto-status and hidden from the default list", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "A"), ctx);
    updateGoal(db, g.id, { status: "archived" }, ctx);
    expect(listGoals(db, false)).toHaveLength(0);
    expect(listGoals(db, true)).toHaveLength(1);
  });
});

describe("linked work and deletion", () => {
  it("lists tasks and activities linked to the goal", () => {
    const g = createGoal(db, goal(), ctx);
    db.insert(tasks).values({ id: "t1", title: "Read docs", goalId: g.id, createdAt: iso(), updatedAt: iso() }).run();
    db.insert(activities).values({ id: "a1", title: "Tutorial", date: "2026-10-03", goalId: g.id, createdAt: iso(), updatedAt: iso() }).run();
    const view = getGoal(db, g.id);
    expect(view.tasks.map((t) => t.title)).toEqual(["Read docs"]);
    expect(view.activities.map((a) => a.title)).toEqual(["Tutorial"]);
  });

  it("soft-deleting hides the goal but keeps its milestones and history", () => {
    const g = createGoal(db, goal(), ctx);
    addMilestone(db, milestone(g.id, "A"), ctx);
    softDeleteGoal(db, g.id, ctx);
    expect(listGoals(db, true)).toHaveLength(0);
    expect(() => getGoal(db, g.id)).toThrow(/not found/i);
    const remaining = (handle.sqlite.prepare("SELECT count(*) AS n FROM milestones").get() as { n: number }).n;
    expect(remaining).toBe(1);
  });
});
