const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Duration in whole minutes between two HH:mm local times.
 * Returns null when either side is missing or the range is not forward in time
 * (validation prevents that case; this guard keeps the function total).
 */
export function calculateDuration(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) {
    return null;
  }
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) {
    return null;
  }
  return endMin - startMin;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${String(m)} min`;
  }
  return m === 0 ? `${String(h)} h` : `${String(h)} h ${String(m)} min`;
}
