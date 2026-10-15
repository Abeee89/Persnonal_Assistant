import { describe, expect, it } from "vitest";
import { addMonths, monthGrid, shiftAnchor, visibleDays, weekDays } from "./calendar";
import { findGaps, formatClock, toInterval, type Interval } from "./timeline";

function spans(...pairs: [string, string][]): Interval[] {
  return pairs.flatMap(([start, end]) => {
    const interval = toInterval(start, end);
    return interval ? [interval] : [];
  });
}

describe("month grid", () => {
  it("is always six full Monday-start weeks", () => {
    const grid = monthGrid("2026-10-15", 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-28");
    expect(grid[41]).toBe("2026-11-08");
  });

  it("starts on Sunday when weekStart is 0", () => {
    expect(monthGrid("2026-10-15", 0)[0]).toBe("2026-09-27");
  });

  it("includes every day of the month", () => {
    const grid = monthGrid("2026-02-10", 1);
    expect(grid).toContain("2026-02-01");
    expect(grid).toContain("2026-02-28");
  });
});

describe("week and visible days", () => {
  it("returns seven days starting on the week start", () => {
    expect(weekDays("2026-10-02", 1)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("day view shows only the anchor", () => {
    expect(visibleDays("day", "2026-10-02")).toEqual(["2026-10-02"]);
  });
});

describe("shiftAnchor", () => {
  it("moves by month, week and day", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-10-02", 1)).toBe("2026-10-09");
    expect(shiftAnchor("day", "2026-12-31", 1)).toBe("2027-01-01");
  });

  it("addMonths always lands on the first of the month", () => {
    expect(addMonths("2026-10-20", 3)).toBe("2027-01-01");
  });
});

describe("timeline gaps", () => {
  it("reports a free stretch of at least the threshold", () => {
    const intervals = spans(["09:00", "10:00"], ["13:00", "14:00"]);
    expect(findGaps(intervals, 120)).toEqual([{ startMin: 600, endMin: 780, minutes: 180 }]);
  });

  it("ignores gaps shorter than the threshold", () => {
    const intervals = spans(["09:00", "10:00"], ["11:00", "12:00"]);
    expect(findGaps(intervals, 120)).toEqual([]);
  });

  it("does not invent a gap when items overlap", () => {
    const intervals = spans(["09:00", "12:00"], ["10:00", "10:30"], ["12:00", "13:00"]);
    expect(findGaps(intervals, 120)).toEqual([]);
  });

  it("treats a start-only item as zero length", () => {
    expect(toInterval("09:00", null)).toEqual({ startMin: 540, endMin: 540 });
  });

  it("rejects a malformed start", () => {
    expect(toInterval("9am", null)).toBeNull();
  });

  it("formats minutes as HH:mm", () => {
    expect(formatClock(540)).toBe("09:00");
    expect(formatClock(1395)).toBe("23:15");
  });
});
