import { parseTimeToMinutes } from "./duration";

export interface Interval {
  startMin: number;
  endMin: number;
}

export interface Gap {
  startMin: number;
  endMin: number;
  minutes: number;
}

/** Converts HH:mm start/end into minutes from midnight. Missing or backwards ends collapse to the start. */
export function toInterval(start: string, end: string | null): Interval | null {
  const startMin = parseTimeToMinutes(start);
  if (startMin === null) {
    return null;
  }
  const endMin = end === null ? null : parseTimeToMinutes(end);
  return { startMin, endMin: endMin !== null && endMin >= startMin ? endMin : startMin };
}

/**
 * Free stretches between timed items of at least `minMinutes` (SDD §10 §9).
 * Overlapping items extend the busy region instead of creating a false gap.
 */
export function findGaps(intervals: readonly Interval[], minMinutes = 120): Gap[] {
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  const gaps: Gap[] = [];
  let busyUntil: number | null = null;
  for (const item of sorted) {
    if (busyUntil !== null) {
      const free = item.startMin - busyUntil;
      if (free >= minMinutes) {
        gaps.push({ startMin: busyUntil, endMin: item.startMin, minutes: free });
      }
    }
    busyUntil = busyUntil === null ? item.endMin : Math.max(busyUntil, item.endMin);
  }
  return gaps;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
