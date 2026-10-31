import type { StatsPeriod } from "@/config/enums";
import { addDays, diffDays, formatIsoDay, parseIsoDay, startOfWeek } from "./dates";

export interface PeriodWindow {
  period: StatsPeriod;
  /** Inclusive first and last local day of the window. */
  from: string;
  to: string;
  /** Number of days the window spans, used as the denominator for per-day metrics. */
  days: number;
  /** Anchor used to compute the previous and next window. */
  anchor: string;
}

export function windowFor(period: StatsPeriod, anchor: string, weekStart: 0 | 1 = 1): PeriodWindow {
  if (period === "day") {
    return { period, from: anchor, to: anchor, days: 1, anchor };
  }
  if (period === "week") {
    const from = startOfWeek(anchor, weekStart);
    const to = addDays(from, 6);
    return { period, from, to, days: 7, anchor };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const date = parseIsoDay(from);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const to = formatIsoDay(lastDay);
  return { period, from, to, days: diffDays(from, to) + 1, anchor };
}

/** Anchor for the same period shifted by one unit; returned as a day inside that window. */
export function shiftPeriod(period: StatsPeriod, anchor: string, delta: number): string {
  if (period === "day") {
    return addDays(anchor, delta);
  }
  if (period === "week") {
    return addDays(anchor, 7 * delta);
  }
  const date = parseIsoDay(`${anchor.slice(0, 7)}-01`);
  return formatIsoDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)));
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const WEEK_LABEL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function periodLabel(window: PeriodWindow): string {
  if (window.period === "day") {
    return DAY_LABEL.format(parseIsoDay(window.anchor));
  }
  if (window.period === "week") {
    return `${WEEK_LABEL.format(parseIsoDay(window.from))} – ${WEEK_LABEL.format(parseIsoDay(window.to))}`;
  }
  return MONTH_LABEL.format(parseIsoDay(window.from));
}
