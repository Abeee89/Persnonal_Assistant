import { addDays, localIsoDay } from "./dates";

export const LANES = ["overdue", "today", "week", "someday", "done"] as const;
export type Lane = (typeof LANES)[number];

export interface LaneInput {
  status: "todo" | "in_progress" | "done" | "cancelled";
  dueDate: string | null;
  completedAt: string | null;
}

/** Done tasks stay visible in the Done lane for today and yesterday (SDD §10 §5). */
export const DONE_VISIBLE_DAYS = 1;
/** "This week" covers the next seven days after today. */
export const WEEK_WINDOW_DAYS = 7;

/**
 * Places one task in exactly one lane, or none (cancelled, or completed long ago).
 * Pure: the caller supplies `today` so the result is deterministic and testable.
 */
export function assignLane(task: LaneInput, today: string): Lane | null {
  if (task.status === "cancelled") {
    return null;
  }
  if (task.status === "done") {
    if (task.completedAt === null) {
      return null;
    }
    const completedDay = localIsoDay(new Date(task.completedAt));
    return completedDay >= addDays(today, -DONE_VISIBLE_DAYS) ? "done" : null;
  }
  if (task.dueDate === null) {
    return "someday";
  }
  if (task.dueDate < today) {
    return "overdue";
  }
  if (task.dueDate === today) {
    return "today";
  }
  if (task.dueDate <= addDays(today, WEEK_WINDOW_DAYS)) {
    return "week";
  }
  return "someday";
}

export function groupByLane<T extends LaneInput>(items: readonly T[], today: string): Record<Lane, T[]> {
  const groups: Record<Lane, T[]> = { overdue: [], today: [], week: [], someday: [], done: [] };
  for (const item of items) {
    const lane = assignLane(item, today);
    if (lane) {
      groups[lane].push(item);
    }
  }
  return groups;
}
