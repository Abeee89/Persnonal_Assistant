import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";

/**
 * Guards the access patterns the app depends on (SDD §06 §5). A missing index shows up
 * as a full table scan, which stays invisible on an empty database and painful at
 * ten years of data. The fixture is small but large enough for the planner to choose
 * the same plan it would with real volume.
 */
let dir: string;
let handle: DatabaseHandle;

function plan(sql: string): string {
  const rows = handle.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[];
  return rows.map((row) => row.detail).join(" | ");
}

function seed() {
  const now = "2026-10-14T08:00:00Z";
  seedDefaultCategories(handle.db, () => now);
  const insertActivity = handle.sqlite.prepare(
    "INSERT INTO activities (id,title,date,category_id,status,duration_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  const insertTask = handle.sqlite.prepare(
    "INSERT INTO tasks (id,title,status,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?)",
  );
  const insertHabit = handle.sqlite.prepare("INSERT INTO habits (id,name,frequency,created_at,updated_at) VALUES (?,?,?,?,?)");
  const insertLog = handle.sqlite.prepare("INSERT OR IGNORE INTO habit_logs (id,habit_id,date,created_at) VALUES (?,?,?,?)");
  const insertJournal = handle.sqlite.prepare("INSERT INTO journals (id,date,content_plain,created_at,updated_at) VALUES (?,?,?,?,?)");

  handle.sqlite.transaction(() => {
    insertHabit.run("h0", "Read", "daily", now, now);
    const seenDays = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const day = `2026-${String((i % 9) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
      insertActivity.run(`a${String(i)}`, `Activity ${String(i)}`, day, i % 2 === 0 ? "default-work" : "default-personal", i % 3 === 0 ? "done" : "planned", 30 + (i % 120), now, now);
      insertTask.run(`t${String(i)}`, `Task ${String(i)}`, i % 4 === 0 ? "done" : "todo", day, now, now);
      if (!seenDays.has(day)) {
        seenDays.add(day);
        insertJournal.run(`j${String(i)}`, day, `notes ${String(i)}`, now, now);
      }
      if (i < 200) {
        insertLog.run(`l${String(i)}`, "h0", day, now);
      }
    }
  })();
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-plan-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  seed();
}, 60000);

afterAll(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("query plans use indexes", () => {
  it("activity list by day uses the alive-date index and does not scan the table", () => {
    const detail = plan("SELECT id FROM activities WHERE deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT 20");
    // "SCAN ... USING INDEX" is an ordered index walk for the LIMIT; a bare table scan would be bad.
    expect(detail).toMatch(/USING (COVERING )?INDEX/);
    expect(detail).not.toMatch(/SCAN activities(?! USING)/);
  });

  it("activities filtered by category and date use a composite index", () => {
    const detail = plan("SELECT id FROM activities WHERE category_id = 'default-work' AND date >= '2026-09-01'");
    expect(detail).toMatch(/idx_act_cat_date/);
  });

  it("open tasks ordered by due date use the due index", () => {
    const detail = plan("SELECT id FROM tasks WHERE status IN ('todo','in_progress') AND due_date >= '2026-10-01'");
    expect(detail).toMatch(/USING (COVERING )?INDEX/);
    expect(detail).not.toMatch(/SCAN tasks(?! USING)/);
  });

  it("habit logs for one habit over a range use the unique index", () => {
    const detail = plan("SELECT date FROM habit_logs WHERE habit_id = 'h0' AND date >= '2026-01-01' AND date <= '2026-12-31'");
    expect(detail).toMatch(/uq_habitlog/);
  });

  it("task pickups by goal use the partial goal index", () => {
    const detail = plan("SELECT id FROM tasks WHERE goal_id = 'nope'");
    expect(detail).toMatch(/idx_task_goal/);
  });

  it("full-text search matches through the FTS index, not a table scan", () => {
    const detail = plan("SELECT kind, ref FROM search_fts WHERE search_fts MATCH '\"backup\"*'");
    expect(detail).toMatch(/VIRTUAL TABLE INDEX/);
  });
});
