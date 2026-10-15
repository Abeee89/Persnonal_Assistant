import { and, asc, between, eq, isNull, lte, gte, inArray } from "drizzle-orm";
import type { DbExec } from "@/db/client";
import { activities, goals, habitLogs, habits, journals, tasks } from "@/db/schema";
import { EVENT_KINDS, type EventKind } from "@/config/enums";
import { toInterval } from "@/lib/domain/timeline";

export interface CalendarEvent {
  id: string;
  kind: EventKind;
  day: string;
  title: string;
  /** HH:mm start for timed items, null for all-day or untimed items. */
  startTime: string | null;
  endTime: string | null;
  href: string;
  /** Status hint used for styling (done, overdue, etc.). */
  status: string | null;
}

export interface EventRange {
  from: string;
  to: string;
  kinds: readonly EventKind[];
}

const ALL_KINDS: readonly EventKind[] = EVENT_KINDS;

export function normaliseKinds(kinds: readonly string[] | undefined): EventKind[] {
  if (!kinds || kinds.length === 0) {
    return [...ALL_KINDS];
  }
  return ALL_KINDS.filter((kind) => kinds.includes(kind));
}

/**
 * Returns every calendar item in [from, to] for the selected kinds, sorted by day
 * then start time. Each kind follows its own date rule (SDD §10 §8):
 * activities by date, tasks by due date, goals by deadline, habits by logged day,
 * journal by entry date. Cancelled tasks and archived or deleted rows are excluded.
 */
export function listEvents(db: DbExec, range: EventRange): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const kinds = new Set(range.kinds);

  if (kinds.has("activity")) {
    const rows = db
      .select({
        id: activities.id,
        title: activities.title,
        date: activities.date,
        startTime: activities.startTime,
        endTime: activities.endTime,
        status: activities.status,
      })
      .from(activities)
      .where(and(isNull(activities.deletedAt), between(activities.date, range.from, range.to)))
      .orderBy(asc(activities.date))
      .all();
    for (const row of rows) {
      out.push({
        id: row.id,
        kind: "activity",
        day: row.date,
        title: row.title,
        startTime: row.startTime,
        endTime: row.endTime,
        href: `/activities/${row.id}`,
        status: row.status,
      });
    }
  }

  if (kinds.has("task")) {
    const rows = db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, status: tasks.status })
      .from(tasks)
      .where(and(between(tasks.dueDate, range.from, range.to), inArray(tasks.status, ["todo", "in_progress", "done"])))
      .orderBy(asc(tasks.dueDate))
      .all();
    for (const row of rows) {
      if (row.dueDate === null) {
        continue;
      }
      out.push({
        id: row.id,
        kind: "task",
        day: row.dueDate,
        title: row.title,
        startTime: null,
        endTime: null,
        href: `/tasks/${row.id}`,
        status: row.status,
      });
    }
  }

  if (kinds.has("goal")) {
    const rows = db
      .select({ id: goals.id, title: goals.title, deadline: goals.deadline, status: goals.status })
      .from(goals)
      .where(
        and(
          isNull(goals.deletedAt),
          between(goals.deadline, range.from, range.to),
          inArray(goals.status, ["not_started", "in_progress", "completed"]),
        ),
      )
      .orderBy(asc(goals.deadline))
      .all();
    for (const row of rows) {
      if (row.deadline === null) {
        continue;
      }
      out.push({
        id: row.id,
        kind: "goal",
        day: row.deadline,
        title: `Deadline: ${row.title}`,
        startTime: null,
        endTime: null,
        href: `/goals/${row.id}`,
        status: row.status,
      });
    }
  }

  if (kinds.has("habit")) {
    const rows = db
      .select({ habitId: habitLogs.habitId, date: habitLogs.date, name: habits.name })
      .from(habitLogs)
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .where(and(eq(habits.archived, false), between(habitLogs.date, range.from, range.to)))
      .orderBy(asc(habitLogs.date))
      .all();
    for (const row of rows) {
      out.push({
        id: `${row.habitId}:${row.date}`,
        kind: "habit",
        day: row.date,
        title: row.name,
        startTime: null,
        endTime: null,
        href: `/habits/${row.habitId}`,
        status: "done",
      });
    }
  }

  if (kinds.has("journal")) {
    const rows = db
      .select({ id: journals.id, date: journals.date, status: journals.status })
      .from(journals)
      .where(
        and(
          isNull(journals.deletedAt),
          eq(journals.type, "daily"),
          gte(journals.date, range.from),
          lte(journals.date, range.to),
        ),
      )
      .orderBy(asc(journals.date))
      .all();
    for (const row of rows) {
      out.push({
        id: row.id,
        kind: "journal",
        day: row.date,
        title: "Journal",
        startTime: null,
        endTime: null,
        href: `/journal/${row.date}`,
        status: row.status,
      });
    }
  }

  return out.sort(compareEvents);
}

/** Day, then timed items by start, then untimed items by kind and title. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.day !== b.day) {
    return a.day < b.day ? -1 : 1;
  }
  const ta = toInterval(a.startTime ?? "", null);
  const tb = toInterval(b.startTime ?? "", null);
  if (ta && tb && ta.startMin !== tb.startMin) {
    return ta.startMin - tb.startMin;
  }
  if (ta && !tb) {
    return -1;
  }
  if (!ta && tb) {
    return 1;
  }
  if (a.kind !== b.kind) {
    return a.kind < b.kind ? -1 : 1;
  }
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}
