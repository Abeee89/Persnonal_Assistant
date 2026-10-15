import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { activities, activityTags, goals, habits, journalTags, journals, tags, tasks, taskTags } from "@/db/schema";
import { search } from "./service";

let dir: string;
let handle: DatabaseHandle;
let db: Db;
const NOW = "2026-10-14T08:00:00.000Z";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-search-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function act(id: string, title: string, description: string | null = null, deletedAt: string | null = null) {
  db.insert(activities).values({ id, title, description, date: "2026-10-02", deletedAt, createdAt: NOW, updatedAt: NOW }).run();
}

describe("indexing through triggers", () => {
  it("finds an activity by title as soon as it is created", () => {
    act("a1", "Build Next.js dashboard");
    expect(search(db, "next").map((h) => h.ref)).toEqual(["a1"]);
  });

  it("finds an activity by its notes", () => {
    act("a1", "Standup", "discussed the router migration");
    expect(search(db, "router").map((h) => h.ref)).toEqual(["a1"]);
  });

  it("re-indexes on update and drops the old words", () => {
    act("a1", "Old name");
    db.update(activities).set({ title: "Fresh name", updatedAt: NOW }).run();
    expect(search(db, "fresh").map((h) => h.ref)).toEqual(["a1"]);
    expect(search(db, "old")).toEqual([]);
  });

  it("removes soft-deleted rows from results and restores them", () => {
    act("a1", "Groceries");
    db.update(activities).set({ deletedAt: NOW }).run();
    expect(search(db, "groceries")).toEqual([]);
    db.update(activities).set({ deletedAt: null }).run();
    expect(search(db, "groceries").map((h) => h.ref)).toEqual(["a1"]);
  });

  it("removes rows on hard delete", () => {
    act("a1", "Temporary");
    db.delete(activities).run();
    expect(search(db, "temporary")).toEqual([]);
  });

  it("indexes tags attached to an entity and refreshes when a tag is added", () => {
    act("a1", "Deep work block");
    db.insert(tags).values({ id: "tg1", name: "focus", slug: "focus", createdAt: NOW }).run();
    expect(search(db, "focus")).toEqual([]);
    db.insert(activityTags).values({ activityId: "a1", tagId: "tg1" }).run();
    expect(search(db, "focus").map((h) => h.ref)).toEqual(["a1"]);
    db.delete(activityTags).run();
    expect(search(db, "focus")).toEqual([]);
  });

  it("indexes tasks, goals and habits with their own text", () => {
    db.insert(tasks).values({ id: "t1", title: "Send invoice", createdAt: NOW, updatedAt: NOW }).run();
    db.insert(goals).values({ id: "g1", title: "Learn Rust", createdAt: NOW, updatedAt: NOW }).run();
    db.insert(habits).values({ id: "h1", name: "Meditate", createdAt: NOW, updatedAt: NOW }).run();
    expect(search(db, "invoice")[0]?.kind).toBe("task");
    expect(search(db, "rust")[0]?.kind).toBe("goal");
    expect(search(db, "meditate")[0]?.kind).toBe("habit");
  });

  it("drops an archived habit from the index and restores it on unarchive", () => {
    db.insert(habits).values({ id: "h1", name: "Stretch", createdAt: NOW, updatedAt: NOW }).run();
    db.update(habits).set({ archived: true }).run();
    expect(search(db, "stretch")).toEqual([]);
    db.update(habits).set({ archived: false }).run();
    expect(search(db, "stretch").map((h) => h.ref)).toEqual(["h1"]);
  });

  it("indexes the journal's plain text, not its raw JSON, and only daily entries", () => {
    db.insert(journals).values([
      { id: "j1", date: "2026-10-02", type: "daily", contentJson: '{"type":"doc"}', contentPlain: "Learned about FTS", createdAt: NOW, updatedAt: NOW },
      { id: "j2", date: "2026-10-03", type: "weekly", contentPlain: "Weekly reflection text", createdAt: NOW, updatedAt: NOW },
    ]).run();
    expect(search(db, "fts").map((h) => h.ref)).toEqual(["j1"]);
    expect(search(db, "weekly")).toEqual([]);
    expect(search(db, "doc")).toEqual([]);
  });

  it("refreshes journal tags", () => {
    db.insert(journals).values({ id: "j1", date: "2026-10-02", type: "daily", contentPlain: "Walk", createdAt: NOW, updatedAt: NOW }).run();
    db.insert(tags).values({ id: "tg2", name: "gratitude", slug: "gratitude", createdAt: NOW }).run();
    db.insert(journalTags).values({ journalId: "j1", tagId: "tg2" }).run();
    expect(search(db, "gratitude").map((h) => h.kind)).toEqual(["journal"]);
  });

  it("refreshes task tags", () => {
    db.insert(tasks).values({ id: "t1", title: "Plan", createdAt: NOW, updatedAt: NOW }).run();
    db.insert(tags).values({ id: "tg3", name: "urgent", slug: "urgent", createdAt: NOW }).run();
    db.insert(taskTags).values({ taskId: "t1", tagId: "tg3" }).run();
    expect(search(db, "urgent").map((h) => h.ref)).toEqual(["t1"]);
  });
});

describe("query behaviour", () => {
  it("matches prefixes so results appear while typing", () => {
    act("a1", "Interview preparation");
    expect(search(db, "interv").map((h) => h.ref)).toEqual(["a1"]);
  });

  it("matches case and accent insensitively", () => {
    act("a1", "Café meeting");
    expect(search(db, "CAFE").map((h) => h.ref)).toEqual(["a1"]);
  });

  it("returns an empty list for input with no searchable tokens", () => {
    act("a1", "Anything");
    expect(search(db, "   ")).toEqual([]);
    expect(search(db, '!!! """')).toEqual([]);
  });

  it("treats FTS operators as plain words, never as query syntax", () => {
    act("a1", "Plain title");
    expect(search(db, "plain OR nothing")).toEqual([]);
    expect(search(db, "title:nothing")).toEqual([]);
  });

  it("strips column filter syntax so a colon only separates words", () => {
    act("a1", "Plain title");
    expect(search(db, "title:plain").map((h) => h.ref)).toEqual(["a1"]);
    expect(search(db, "title:nothing")).toEqual([]);
  });

  it("neutralises quote characters so input cannot break out of the query", () => {
    act("a1", "O'Brien notes");
    expect(() => search(db, "O'Brien")).not.toThrow();
    expect(() => search(db, "x'); DROP TABLE activities; --")).not.toThrow();
    expect(search(db, "O'Brien").map((h) => h.ref)).toEqual(["a1"]);
    expect((handle.sqlite.prepare("SELECT count(*) AS n FROM activities").get() as { n: number }).n).toBe(1);
  });

  it("filters by kind", () => {
    act("a1", "Shared word");
    db.insert(tasks).values({ id: "t1", title: "Shared word", createdAt: NOW, updatedAt: NOW }).run();
    expect(search(db, "shared", { kinds: ["task"] }).map((h) => h.kind)).toEqual(["task"]);
  });

  it("caps results per kind", () => {
    for (let i = 0; i < 5; i += 1) {
      act(`a${String(i)}`, `Repeated term ${String(i)}`);
    }
    expect(search(db, "repeated", { limitPerKind: 3 })).toHaveLength(3);
  });

  it("returns highlight segments and a canonical href per kind", () => {
    act("a1", "Build Next.js dashboard");
    const [hit] = search(db, "next");
    expect(hit?.href).toBe("/activities/a1");
    expect(hit?.kindLabel).toBe("Activity");
    expect(hit?.snippet.some((s) => s.match && s.text.toLowerCase() === "next")).toBe(true);
  });

  it("links a journal hit to its date", () => {
    db.insert(journals).values({ id: "j1", date: "2026-10-02", type: "daily", contentPlain: "Notes on Next", createdAt: NOW, updatedAt: NOW }).run();
    expect(search(db, "next")[0]?.href).toBe("/journal/2026-10-02");
  });
});
