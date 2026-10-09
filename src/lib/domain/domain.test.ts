import { describe, expect, it } from "vitest";
import { addDays, diffDays, formatIsoDay, isIsoDay, parseIsoDay, startOfWeek } from "./dates";
import { calculateDuration, formatDuration, parseTimeToMinutes } from "./duration";
import { calculateGoalProgress } from "./goal-progress";
import { calculateDailyStreak, calculateHabitStreak, calculateWeeklyStreak } from "./habit-streak";
import { calculateProductivityScore, SCORE_WEIGHTS } from "./productivity-score";

describe("dates", () => {
  it("validates ISO days strictly, including impossible dates", () => {
    expect(isIsoDay("2026-10-02")).toBe(true);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("2026-10-2")).toBe(false);
  });

  it("round-trips parse/format", () => {
    expect(formatIsoDay(parseIsoDay("2026-10-02"))).toBe("2026-10-02");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days regardless of DST (UTC arithmetic)", () => {
    expect(diffDays("2026-03-01", "2026-03-31")).toBe(30);
    expect(diffDays("2026-10-02", "2026-10-01")).toBe(-1);
  });

  it("computes week start for Monday and Sunday conventions", () => {
    // 2026-10-02 is a Friday
    expect(startOfWeek("2026-10-02", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-02", 0)).toBe("2026-09-27");
  });

  it("throws on invalid day input", () => {
    expect(() => parseIsoDay("nope")).toThrow(RangeError);
  });
});

describe("calculateDuration", () => {
  it("returns minutes between HH:mm values", () => {
    expect(calculateDuration("15:00", "17:30")).toBe(150);
  });

  it("returns null for missing or non-forward ranges", () => {
    expect(calculateDuration(null, "10:00")).toBeNull();
    expect(calculateDuration("10:00", undefined)).toBeNull();
    expect(calculateDuration("10:00", "10:00")).toBeNull();
    expect(calculateDuration("11:00", "10:00")).toBeNull();
  });

  it("rejects malformed times", () => {
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("9:00")).toBeNull();
  });

  it("formats durations for humans", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("calculateGoalProgress", () => {
  const ms = (...done: boolean[]) => done.map((d) => ({ done: d }));

  it("auto mode: completed / total milestones, rounded", () => {
    expect(calculateGoalProgress({ progressMode: "auto", manualProgress: null, milestones: ms(true, true, false, false, false) })).toBe(40);
    expect(calculateGoalProgress({ progressMode: "auto", manualProgress: null, milestones: ms(true, true, true) })).toBe(100);
    expect(calculateGoalProgress({ progressMode: "auto", manualProgress: null, milestones: ms(true, false, false) })).toBe(33);
  });

  it("auto mode with no milestones is 0", () => {
    expect(calculateGoalProgress({ progressMode: "auto", manualProgress: 80, milestones: [] })).toBe(0);
  });

  it("manual mode ignores milestones and respects the stored value", () => {
    expect(calculateGoalProgress({ progressMode: "manual", manualProgress: 65, milestones: ms(true, true) })).toBe(65);
  });

  it("manual mode clamps to 0..100 and defaults to 0", () => {
    expect(calculateGoalProgress({ progressMode: "manual", manualProgress: 140, milestones: [] })).toBe(100);
    expect(calculateGoalProgress({ progressMode: "manual", manualProgress: -5, milestones: [] })).toBe(0);
    expect(calculateGoalProgress({ progressMode: "manual", manualProgress: null, milestones: [] })).toBe(0);
  });
});

describe("calculateDailyStreak", () => {
  const today = "2026-10-10";

  it("is zero with no logs", () => {
    expect(calculateDailyStreak([], today)).toEqual({ current: 0, best: 0 });
  });

  it("counts consecutive days ending today", () => {
    const logs = ["2026-10-08", "2026-10-09", "2026-10-10"];
    expect(calculateDailyStreak(logs, today)).toEqual({ current: 3, best: 3 });
  });

  it("keeps the streak through yesterday when today is not logged yet", () => {
    const logs = ["2026-10-08", "2026-10-09"];
    expect(calculateDailyStreak(logs, today)).toEqual({ current: 2, best: 2 });
  });

  it("resets current to zero after a missed day but keeps best", () => {
    const logs = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-07", "2026-10-08"];
    expect(calculateDailyStreak(logs, today)).toEqual({ current: 0, best: 3 });
  });

  it("ignores duplicate log dates", () => {
    const logs = ["2026-10-09", "2026-10-09", "2026-10-10"];
    expect(calculateDailyStreak(logs, today)).toEqual({ current: 2, best: 2 });
  });
});

describe("calculateWeeklyStreak", () => {
  it("counts consecutive weeks meeting the target", () => {
    // weeks starting Mon 2026-09-14, 09-21, 09-28 each with 3 logs; target 3
    const logs = [
      "2026-09-14", "2026-09-15", "2026-09-16",
      "2026-09-21", "2026-09-22", "2026-09-23",
      "2026-09-28", "2026-09-29", "2026-09-30",
    ];
    expect(calculateWeeklyStreak(logs, "2026-10-02", 3)).toEqual({ current: 3, best: 3 });
  });

  it("a week below target breaks the streak", () => {
    const logs = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-28", "2026-09-29", "2026-09-30"];
    const result = calculateWeeklyStreak(logs, "2026-10-02", 3);
    expect(result.best).toBe(1);
    expect(result.current).toBe(1);
  });
});

describe("calculateHabitStreak dispatcher", () => {
  it("routes by frequency", () => {
    expect(
      calculateHabitStreak({ frequency: "daily", logDates: ["2026-10-09", "2026-10-10"], today: "2026-10-10" }),
    ).toEqual({ current: 2, best: 2 });
    expect(
      calculateHabitStreak({
        frequency: "monthly",
        logDates: ["2026-08-05", "2026-09-05", "2026-10-03"],
        today: "2026-10-09",
      }),
    ).toEqual({ current: 3, best: 3 });
  });

  it("monthly streak breaks across a skipped month", () => {
    expect(
      calculateHabitStreak({ frequency: "monthly", logDates: ["2026-07-01", "2026-09-01"], today: "2026-10-01" }),
    ).toEqual({ current: 1, best: 1 });
  });
});

describe("calculateProductivityScore", () => {
  const perfect = {
    tasksDone: 4,
    tasksDue: 4,
    activitiesDone: 5,
    activitiesPlanned: 5,
    habitsHit: 3,
    habitsExpected: 3,
    journaledDays: 7,
    windowDays: 7,
  };

  it("is 100 for a perfect window", () => {
    expect(calculateProductivityScore(perfect)).toBe(100);
  });

  it("is 0 for an empty window, without dividing by zero", () => {
    expect(
      calculateProductivityScore({
        tasksDone: 0,
        tasksDue: 0,
        activitiesDone: 0,
        activitiesPlanned: 0,
        habitsHit: 0,
        habitsExpected: 0,
        journaledDays: 0,
        windowDays: 0,
      }),
    ).toBe(0);
  });

  it("weights sum to 1", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("weights tasks at 35% of the score", () => {
    expect(
      calculateProductivityScore({ ...perfect, activitiesDone: 0, habitsHit: 0, journaledDays: 0 }),
    ).toBe(35);
  });

  it("stays within 0..100 even with inconsistent inputs", () => {
    const score = calculateProductivityScore({ ...perfect, tasksDone: 99 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
