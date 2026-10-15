import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { activities, goals, habitLogs, habits, journals, tasks } from "@/db/schema";
import { compareEvents, listEvents, normaliseKinds, type CalendarEvent } from "./service";

let dir: string;
let handle: DatabaseHandle;
let db: Db;
const NOW = "2026-10-02T08:00:00.000Z";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cal-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  db.insert(activities)
    .values([
      { id: "a1", title: "Standup", date: "2026-10-02", startTime: "09:00", endTime: "09:15", createdAt: NOW, updatedAt: NOW },
      { id: "a2", title: "Coding", date: "2026-10-02", startTime: "15:00", endTime: "17:00", createdAt: NOW, updatedAt: NOW },
      { id: "a3", title: "Groceries", date: "2026-10-02", createdAt: NOW, updatedAt: NOW },
      { id: "a4", title: "Out of range", date: "2026-11-01", createdAt: NOW, updatedAt: NOW },
      { id: "a5", title: "Gone", date: "2026-10-03", createdAt: NOW, updatedAt: NOW, deletedAt: NOW },
    ])
    .run();
  db.insert(tasks)
    .values([
      { id: "t1", title: "Send invoice", dueDate: "2026-10-05", status: "todo", createdAt: NOW, updatedAt: NOW },
      { id: "t2", title: "Old idea", dueDate: "2026-10-05", status: "cancelled", createdAt: NOW, updatedAt: NOW },
      { id: "t3", title: "No date", status: "todo", createdAt: NOW, updatedAt: NOW },
    ])
    .run();
  db.insert(goals)
    .values([
      { id: "g1", title: "Learn Next.js", deadline: "2026-12-31", createdAt: NOW, updatedAt: NOW },
      { id: "g2", title: "Archived goal", deadline: "2026-10-20", status: "archived", createdAt: NOW, updatedAt: NOW },
    ])
    .run();
  db.insert(habits)
    .values([
      { id: "h1", name: "Read", createdAt: NOW, updatedAt: NOW },
      { id: "h2", name: "Retired", archived: true, createdAt: NOW, updatedAt: NOW },
    ])
    .run();
  db.insert(habitLogs)
    .values([
      { id: "l1", habitId: "h1", date: "2026-10-02", createdAt: NOW },
      { id: "l2", habitId: "h2", date: "2026-10-02", createdAt: NOW },
    ])
    .run();
  db.insert(journals)
    .values([
      { id: "j1", date: "2026-10-02", type: "daily", createdAt: NOW, updatedAt: NOW },
      { id: "j2", date: "2026-10-02", type: "weekly", createdAt: NOW, updatedAt: NOW },
    ])
    .run();
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const ALL = normaliseKinds(undefined);

function on(day: string, events: CalendarEvent[]) {
  return events.filter((event) => event.day === day);
}

describe("listEvents", () => {
  it("collects every kind for the range, with the correct date rule for each", () => {
    const events = listEvents(db, { from: "2026-10-01", to: "2026-10-31", kinds: ALL });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["activity", "task", "habit", "journal"]));
    expect(events.find((e) => e.id === "t1")?.day).toBe("2026-10-05");
    expect(events.find((e) => e.id === "h1:2026-10-02")?.kind).toBe("habit");
  });

  it("excludes soft-deleted activities and out-of-range rows", () => {
    const titles = listEvents(db, { from: "2026-10-01", to: "2026-10-31", kinds: ALL }).map((e) => e.title);
    expect(titles).not.toContain("Gone");
    expect(titles).not.toContain("Out of range");
  });

  it("excludes cancelled tasks, tasks without a due date, and archived habits", () => {
    const events = listEvents(db, { from: "2026-10-01", to: "2026-12-31", kinds: ALL });
    expect(events.map((e) => e.id)).not.toContain("t2");
    expect(events.map((e) => e.id)).not.toContain("t3");
    expect(events.map((e) => e.id)).not.toContain("l2");
  });

  it("shows goal deadlines but not archived goals", () => {
    const events = listEvents(db, { from: "2026-10-01", to: "2026-12-31", kinds: ALL });
    const deadlines = events.filter((e) => e.kind === "goal").map((e) => e.title);
    expect(deadlines).toEqual(["Deadline: Learn Next.js"]);
  });

  it("returns only the requested kinds (entity filter)", () => {
    const events = listEvents(db, { from: "2026-10-01", to: "2026-10-31", kinds: ["activity"] });
    expect(new Set(events.map((e) => e.kind))).toEqual(new Set(["activity"]));
  });

  it("keeps a day's timed items ordered by start, then untimed ones", () => {
    const day = on("2026-10-02", listEvents(db, { from: "2026-10-02", to: "2026-10-02", kinds: ALL }));
    const activityTitles = day.filter((e) => e.kind === "activity").map((e) => e.title);
    expect(activityTitles).toEqual(["Standup", "Coding", "Groceries"]);
  });

  it("links each event to its detail page", () => {
    const events = listEvents(db, { from: "2026-10-02", to: "2026-10-02", kinds: ["activity", "journal"] });
    expect(events.find((e) => e.id === "a1")?.href).toBe("/activities/a1");
    expect(events.find((e) => e.kind === "journal")?.href).toBe("/journal/2026-10-02");
  });

  it("returns an empty list for an empty range", () => {
    expect(listEvents(db, { from: "2030-01-01", to: "2030-01-31", kinds: ALL })).toEqual([]);
  });
});

describe("normaliseKinds", () => {
  it("defaults to every kind and drops unknown ones", () => {
    expect(normaliseKinds(undefined)).toHaveLength(5);
    expect(normaliseKinds(["task", "bogus"])).toEqual(["task"]);
  });
});

describe("compareEvents", () => {
  it("sorts by day before time", () => {
    const a: CalendarEvent = { id: "1", kind: "task", day: "2026-10-01", title: "z", startTime: null, endTime: null, href: "", status: null };
    const b: CalendarEvent = { id: "2", kind: "activity", day: "2026-10-02", title: "a", startTime: "08:00", endTime: null, href: "", status: null };
    expect(compareEvents(a, b)).toBeLessThan(0);
  });
});
