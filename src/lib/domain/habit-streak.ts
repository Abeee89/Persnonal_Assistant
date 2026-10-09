import { diffDays, startOfWeek } from "./dates";

export type HabitFrequency = "daily" | "weekly" | "monthly";

export interface HabitStreakInput {
  frequency: HabitFrequency;
  /** Days (YYYY-MM-DD) on which the habit was logged. Duplicates are ignored. */
  logDates: readonly string[];
  /** Today's day, used as the anchor. */
  today: string;
  /** For weekly habits: required completions per week (default 1). */
  targetPerPeriod?: number;
}

export interface HabitStreakResult {
  current: number;
  best: number;
}

/**
 * Daily streak: consecutive calendar days with a log.
 * Grace: if today has no log yet, the streak still counts through yesterday
 * (SDD §10 §7) so the user is not punished before the day is over.
 */
export function calculateDailyStreak(logDates: readonly string[], today: string): HabitStreakResult {
  const days = [...new Set(logDates)].sort();
  if (days.length === 0) {
    return { current: 0, best: 0 };
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1];
    const curr = days[i];
    if (prev !== undefined && curr !== undefined && diffDays(prev, curr) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const last = days[days.length - 1] ?? "";
  const gap = diffDays(last, today);
  if (gap > 1) {
    return { current: 0, best };
  }

  let current = 1;
  for (let i = days.length - 1; i > 0; i -= 1) {
    const prev = days[i - 1];
    const curr = days[i];
    if (prev !== undefined && curr !== undefined && diffDays(prev, curr) === 1) {
      current += 1;
    } else {
      break;
    }
  }
  return { current, best };
}

/**
 * Weekly streak: consecutive weeks where logs >= targetPerPeriod.
 * The current (unfinished) week does not break the streak if it is still in progress.
 */
export function calculateWeeklyStreak(
  logDates: readonly string[],
  today: string,
  targetPerPeriod = 1,
  weekStart: 0 | 1 = 1,
): HabitStreakResult {
  const counts = new Map<string, number>();
  for (const day of new Set(logDates)) {
    const week = startOfWeek(day, weekStart);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const hitWeeks = [...counts.entries()]
    .filter(([, count]) => count >= targetPerPeriod)
    .map(([week]) => week)
    .sort();

  if (hitWeeks.length === 0) {
    return { current: 0, best: 0 };
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < hitWeeks.length; i += 1) {
    const prev = hitWeeks[i - 1];
    const curr = hitWeeks[i];
    if (prev !== undefined && curr !== undefined && diffDays(prev, curr) === 7) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const currentWeek = startOfWeek(today, weekStart);
  const lastHit = hitWeeks[hitWeeks.length - 1] ?? "";
  const gapWeeks = diffDays(lastHit, currentWeek) / 7;
  if (gapWeeks > 1) {
    return { current: 0, best };
  }

  let current = 1;
  for (let i = hitWeeks.length - 1; i > 0; i -= 1) {
    const prev = hitWeeks[i - 1];
    const curr = hitWeeks[i];
    if (prev !== undefined && curr !== undefined && diffDays(prev, curr) === 7) {
      current += 1;
    } else {
      break;
    }
  }
  return { current, best };
}

/**
 * Monthly streak: consecutive calendar months with >= targetPerPeriod logs.
 * The current month does not break the streak while still in progress.
 */
export function calculateMonthlyStreak(
  logDates: readonly string[],
  today: string,
  targetPerPeriod = 1,
): HabitStreakResult {
  const counts = new Map<number, number>();
  for (const day of new Set(logDates)) {
    const key = monthIndex(day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const hitMonths = [...counts.entries()]
    .filter(([, count]) => count >= targetPerPeriod)
    .map(([month]) => month)
    .sort((a, b) => a - b);

  if (hitMonths.length === 0) {
    return { current: 0, best: 0 };
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < hitMonths.length; i += 1) {
    const prev = hitMonths[i - 1];
    const curr = hitMonths[i];
    if (prev !== undefined && curr !== undefined && curr - prev === 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const currentMonth = monthIndex(today);
  const lastHit = hitMonths[hitMonths.length - 1] ?? 0;
  if (currentMonth - lastHit > 1) {
    return { current: 0, best };
  }

  let current = 1;
  for (let i = hitMonths.length - 1; i > 0; i -= 1) {
    const prev = hitMonths[i - 1];
    const curr = hitMonths[i];
    if (prev !== undefined && curr !== undefined && curr - prev === 1) {
      current += 1;
    } else {
      break;
    }
  }
  return { current, best };
}

function monthIndex(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return year * 12 + (month - 1);
}

export function calculateHabitStreak(input: HabitStreakInput): HabitStreakResult {
  if (input.frequency === "daily") {
    return calculateDailyStreak(input.logDates, input.today);
  }
  if (input.frequency === "weekly") {
    return calculateWeeklyStreak(input.logDates, input.today, input.targetPerPeriod ?? 1);
  }
  return calculateMonthlyStreak(input.logDates, input.today, input.targetPerPeriod ?? 1);
}
