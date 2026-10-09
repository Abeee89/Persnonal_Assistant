import { addDays, diffDays, startOfWeek } from "./dates";
import type { HabitFrequency } from "./habit-streak";

function periodKey(frequency: HabitFrequency, day: string): string {
  if (frequency === "daily") {
    return day;
  }
  if (frequency === "weekly") {
    return startOfWeek(day, 1);
  }
  return day.slice(0, 7);
}

function monthIndex(day: string): number {
  return Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1);
}

function periodsBetween(frequency: HabitFrequency, from: string, to: string): number {
  if (frequency === "daily") {
    return diffDays(from, to) + 1;
  }
  if (frequency === "weekly") {
    return diffDays(startOfWeek(from, 1), startOfWeek(to, 1)) / 7 + 1;
  }
  return monthIndex(to) - monthIndex(from) + 1;
}

function percent(hits: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((hits / total) * 100));
}

/** Logs recorded within the current period (today's day, this week, or this month). */
export function countInCurrentPeriod(frequency: HabitFrequency, logDates: readonly string[], today: string): number {
  const key = periodKey(frequency, today);
  let count = 0;
  for (const day of new Set(logDates)) {
    if (periodKey(frequency, day) === key) {
      count += 1;
    }
  }
  return count;
}

export interface CompletionRateInput {
  frequency: HabitFrequency;
  logDates: readonly string[];
  createdDay: string;
  today: string;
  targetPerPeriod?: number;
  /** Daily habits use a trailing window; weekly/monthly use every period since creation. */
  windowDays?: number;
}

/**
 * Completion rate 0–100 (SDD §11 §3.2).
 * Daily: logged days ÷ days in the trailing window (clipped to the creation day).
 * Weekly/monthly: periods that met the target ÷ periods elapsed since creation.
 */
export function calculateCompletionRate(input: CompletionRateInput): number {
  const logs = [...new Set(input.logDates)].filter((day) => day >= input.createdDay && day <= input.today);

  if (input.frequency === "daily") {
    const window = input.windowDays ?? 30;
    const windowStart = addDays(input.today, -(window - 1));
    const start = input.createdDay > windowStart ? input.createdDay : windowStart;
    const days = diffDays(start, input.today) + 1;
    const hits = logs.filter((day) => day >= start).length;
    return percent(hits, days);
  }

  const target = input.targetPerPeriod ?? 1;
  const counts = new Map<string, number>();
  for (const day of logs) {
    const key = periodKey(input.frequency, day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let hits = 0;
  for (const count of counts.values()) {
    if (count >= target) {
      hits += 1;
    }
  }
  return percent(hits, periodsBetween(input.frequency, input.createdDay, input.today));
}
