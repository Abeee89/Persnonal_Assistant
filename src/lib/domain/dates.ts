/**
 * Local calendar-day helpers. The app stores days as `YYYY-MM-DD` text and
 * never does timezone math in the database (SDD §03 §4.1). These helpers
 * work on that representation with UTC arithmetic to avoid DST drift.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDay(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) {
    return false;
  }
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseIsoDay(value: string): Date {
  if (!isIsoDay(value)) {
    throw new RangeError(`Invalid day: ${value}`);
  }
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Device-local calendar day for "today" defaults (not UTC). */
export function localIsoDay(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatIsoDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${String(y)}-${m}-${d}`;
}

export function addDays(day: string, delta: number): string {
  const date = parseIsoDay(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return formatIsoDay(date);
}

export function diffDays(from: string, to: string): number {
  const ms = parseIsoDay(to).getTime() - parseIsoDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-based ISO week start, or Sunday when weekStart=0. */
export function startOfWeek(day: string, weekStart: 0 | 1 = 1): string {
  const date = parseIsoDay(day);
  const dow = date.getUTCDay();
  const offset = (dow - weekStart + 7) % 7;
  return addDays(day, -offset);
}
