import type { CalendarView } from "@/config/enums";
import { addDays, formatIsoDay, parseIsoDay, startOfWeek } from "./dates";

/** Shifts a day to the first of the month `delta` months away. */
export function addMonths(day: string, delta: number): string {
  const date = parseIsoDay(day);
  return formatIsoDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)));
}

/** Six full weeks starting on the week-start day that contains the 1st of the anchor month. */
export function monthGrid(anchor: string, weekStart: 0 | 1 = 1): string[] {
  const first = startOfWeek(`${anchor.slice(0, 7)}-01`, weekStart);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function weekDays(anchor: string, weekStart: 0 | 1 = 1): string[] {
  const first = startOfWeek(anchor, weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Every day the view displays, in order. */
export function visibleDays(view: CalendarView, anchor: string, weekStart: 0 | 1 = 1): string[] {
  if (view === "month") {
    return monthGrid(anchor, weekStart);
  }
  if (view === "week") {
    return weekDays(anchor, weekStart);
  }
  return [anchor];
}

/** Moves the anchor one unit of the current view forward or back. */
export function shiftAnchor(view: CalendarView, anchor: string, delta: number): string {
  if (view === "month") {
    return addMonths(anchor, delta);
  }
  if (view === "week") {
    return addDays(anchor, 7 * delta);
  }
  return addDays(anchor, delta);
}
