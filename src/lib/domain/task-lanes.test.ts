import { describe, expect, it } from "vitest";
import { assignLane, groupByLane } from "./task-lanes";

const TODAY = "2026-10-10";
const at = (day: string) => `${day}T12:00:00`;

describe("assignLane", () => {
  it("puts an open task due before today in overdue", () => {
    expect(assignLane({ status: "todo", dueDate: "2026-10-09", completedAt: null }, TODAY)).toBe("overdue");
  });

  it("puts an open task due today in today, including in_progress", () => {
    expect(assignLane({ status: "in_progress", dueDate: TODAY, completedAt: null }, TODAY)).toBe("today");
  });

  it("puts tasks due in the next seven days in week", () => {
    expect(assignLane({ status: "todo", dueDate: "2026-10-11", completedAt: null }, TODAY)).toBe("week");
    expect(assignLane({ status: "todo", dueDate: "2026-10-17", completedAt: null }, TODAY)).toBe("week");
  });

  it("puts tasks due later, or with no date, in someday", () => {
    expect(assignLane({ status: "todo", dueDate: "2026-10-18", completedAt: null }, TODAY)).toBe("someday");
    expect(assignLane({ status: "todo", dueDate: null, completedAt: null }, TODAY)).toBe("someday");
  });

  it("keeps tasks completed today or yesterday in done", () => {
    expect(assignLane({ status: "done", dueDate: TODAY, completedAt: at(TODAY) }, TODAY)).toBe("done");
    expect(assignLane({ status: "done", dueDate: null, completedAt: at("2026-10-09") }, TODAY)).toBe("done");
  });

  it("hides tasks completed before yesterday", () => {
    expect(assignLane({ status: "done", dueDate: null, completedAt: at("2026-10-08") }, TODAY)).toBeNull();
  });

  it("never shows cancelled tasks", () => {
    expect(assignLane({ status: "cancelled", dueDate: TODAY, completedAt: null }, TODAY)).toBeNull();
  });

  it("treats a done task without completedAt as hidden rather than guessing a date", () => {
    expect(assignLane({ status: "done", dueDate: null, completedAt: null }, TODAY)).toBeNull();
  });
});

describe("groupByLane", () => {
  it("sorts a mixed set into the right buckets", () => {
    const groups = groupByLane(
      [
        { id: "a", status: "todo", dueDate: "2026-10-01", completedAt: null },
        { id: "b", status: "todo", dueDate: TODAY, completedAt: null },
        { id: "c", status: "todo", dueDate: null, completedAt: null },
        { id: "d", status: "cancelled", dueDate: null, completedAt: null },
      ],
      TODAY,
    );
    expect(groups.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(groups.today.map((t) => t.id)).toEqual(["b"]);
    expect(groups.someday.map((t) => t.id)).toEqual(["c"]);
    expect(groups.week).toEqual([]);
    expect(groups.done).toEqual([]);
  });
});
