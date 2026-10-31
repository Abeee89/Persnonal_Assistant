import { describe, expect, it } from "vitest";
import { periodLabel, shiftPeriod, windowFor } from "./stats-window";

describe("windowFor", () => {
  it("day window is the anchor itself", () => {
    expect(windowFor("day", "2026-10-14")).toMatchObject({ from: "2026-10-14", to: "2026-10-14", days: 1 });
  });

  it("week window spans the configured week start", () => {
    expect(windowFor("week", "2026-10-14", 1)).toMatchObject({ from: "2026-10-12", to: "2026-10-18", days: 7 });
    expect(windowFor("week", "2026-10-14", 0)).toMatchObject({ from: "2026-10-11", to: "2026-10-17", days: 7 });
  });

  it("month window covers the whole month, including leap Februaries", () => {
    expect(windowFor("month", "2026-02-10")).toMatchObject({ from: "2026-02-01", to: "2026-02-28", days: 28 });
    expect(windowFor("month", "2024-02-10")).toMatchObject({ from: "2024-02-01", to: "2024-02-29", days: 29 });
    expect(windowFor("month", "2026-04-30")).toMatchObject({ from: "2026-04-01", to: "2026-04-30", days: 30 });
  });
});

describe("shiftPeriod", () => {
  it("shifts by one day, week or month", () => {
    expect(shiftPeriod("day", "2026-10-14", 1)).toBe("2026-10-15");
    expect(shiftPeriod("day", "2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftPeriod("week", "2026-10-14", 1)).toBe("2026-10-21");
    expect(shiftPeriod("week", "2026-10-14", -1)).toBe("2026-10-07");
    expect(shiftPeriod("month", "2026-10-14", 1)).toBe("2026-11-01");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
  });
});

describe("periodLabel", () => {
  it("labels each period readably", () => {
    expect(periodLabel(windowFor("day", "2026-10-14"))).toContain("October");
    expect(periodLabel(windowFor("week", "2026-10-14", 1))).toContain("–");
    expect(periodLabel(windowFor("month", "2026-10-14"))).toBe("October 2026");
  });
});
