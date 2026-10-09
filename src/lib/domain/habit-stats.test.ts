import { describe, expect, it } from "vitest";
import { calculateCompletionRate, countInCurrentPeriod } from "./habit-stats";

describe("countInCurrentPeriod", () => {
  it("counts today for daily habits", () => {
    expect(countInCurrentPeriod("daily", ["2026-10-09", "2026-10-10"], "2026-10-10")).toBe(1);
  });

  it("counts logs in the same Monday-start week for weekly habits", () => {
    // 2026-10-05 is Monday; 2026-10-10 is Saturday of the same week
    expect(countInCurrentPeriod("weekly", ["2026-10-05", "2026-10-07", "2026-09-30"], "2026-10-10")).toBe(2);
  });

  it("counts logs in the same month for monthly habits", () => {
    expect(countInCurrentPeriod("monthly", ["2026-10-01", "2026-09-30"], "2026-10-10")).toBe(1);
  });

  it("ignores duplicate dates", () => {
    expect(countInCurrentPeriod("daily", ["2026-10-10", "2026-10-10"], "2026-10-10")).toBe(1);
  });
});

describe("calculateCompletionRate", () => {
  it("daily: logged days over the trailing 30-day window", () => {
    const logs = Array.from({ length: 15 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 8, 11) + i * 86_400_000).toISOString().slice(0, 10);
      return day;
    });
    expect(
      calculateCompletionRate({ frequency: "daily", logDates: logs, createdDay: "2026-08-01", today: "2026-10-10" }),
    ).toBe(50);
  });

  it("daily: clips the window to the creation day", () => {
    expect(
      calculateCompletionRate({
        frequency: "daily",
        logDates: ["2026-10-08", "2026-10-09", "2026-10-10"],
        createdDay: "2026-10-08",
        today: "2026-10-10",
      }),
    ).toBe(100);
  });

  it("daily: a habit created today with no log is 0, never NaN", () => {
    expect(
      calculateCompletionRate({ frequency: "daily", logDates: [], createdDay: "2026-10-10", today: "2026-10-10" }),
    ).toBe(0);
  });

  it("weekly: periods meeting the target over periods since creation", () => {
    const logs = ["2026-09-14", "2026-09-15", "2026-09-21", "2026-09-22", "2026-09-28", "2026-10-06"];
    expect(
      calculateCompletionRate({
        frequency: "weekly",
        logDates: logs,
        createdDay: "2026-09-14",
        today: "2026-10-10",
        targetPerPeriod: 2,
      }),
    ).toBe(50);
  });

  it("monthly: months meeting the target over months since creation", () => {
    expect(
      calculateCompletionRate({
        frequency: "monthly",
        logDates: ["2026-08-03", "2026-10-02"],
        createdDay: "2026-08-01",
        today: "2026-10-10",
      }),
    ).toBe(67);
  });

  it("never exceeds 100 even with logs outside the range", () => {
    expect(
      calculateCompletionRate({
        frequency: "daily",
        logDates: ["2026-01-01", "2026-10-10"],
        createdDay: "2026-10-10",
        today: "2026-10-10",
      }),
    ).toBe(100);
  });
});
