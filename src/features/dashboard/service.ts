import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { DbExec } from "@/db/client";
import { journals, tasks } from "@/db/schema";
import { pickFocusCard, type FocusCard } from "@/lib/domain/focus";
import { listEvents, type CalendarEvent } from "@/features/calendar/service";
import { listHabits, type HabitView } from "@/features/habits/service";
import { listGoals } from "@/features/goals/service";

export interface DashboardSnapshot {
  day: string;
  activitiesToday: number;
  tasks: { done: number; total: number; overdue: number };
  habits: { done: number; total: number };
  goalAverage: number | null;
  activeGoals: number;
  /** Timed and due items for the day: activities and tasks. */
  timeline: CalendarEvent[];
  todayJournal: { id: string; preview: string; status: "draft" | "final" } | null;
  recentJournal: { date: string; preview: string } | null;
  focus: FocusCard;
  focusGoal: { id: string; title: string; progress: number; deadline: string | null } | null;
  habitList: HabitView[];
}

/** Tasks counted for "today": due today, plus anything overdue that is still open. */
function taskCounts(db: DbExec, day: string) {
  const dueToday = db
    .select({
      total: count(),
      done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)`,
    })
    .from(tasks)
    .where(and(eq(tasks.dueDate, day), sql`${tasks.status} != 'cancelled'`))
    .get();
  const overdue = db
    .select({ n: count() })
    .from(tasks)
    .where(and(sql`${tasks.dueDate} < ${day}`, sql`${tasks.status} IN ('todo', 'in_progress')`))
    .get();
  return {
    done: dueToday?.done ?? 0,
    total: dueToday?.total ?? 0,
    overdue: overdue?.n ?? 0,
  };
}

function todayJournalOf(db: DbExec, day: string) {
  const row = db
    .select({ id: journals.id, contentPlain: journals.contentPlain, status: journals.status })
    .from(journals)
    .where(and(eq(journals.date, day), eq(journals.type, "daily"), isNull(journals.deletedAt)))
    .get();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    preview: row.contentPlain.slice(0, 160),
    status: row.status as "draft" | "final",
  };
}

function recentJournalOf(db: DbExec, day: string) {
  const row = db
    .select({ date: journals.date, contentPlain: journals.contentPlain })
    .from(journals)
    .where(and(eq(journals.type, "daily"), isNull(journals.deletedAt), sql`${journals.date} < ${day}`, sql`${journals.contentPlain} != ''`))
    .orderBy(sql`${journals.date} DESC`)
    .limit(1)
    .get();
  return row ? { date: row.date, preview: row.contentPlain.slice(0, 160) } : null;
}

/**
 * One read path for the landing pages. Each part reuses the owning feature's
 * query so business rules (lanes, streaks, progress) stay in one place.
 */
export function buildDashboard(db: DbExec, day: string): DashboardSnapshot {
  const events = listEvents(db, { from: day, to: day, kinds: ["activity", "task", "goal", "habit", "journal"] });
  const activitiesToday = events.filter((e) => e.kind === "activity").length;
  const habitList = listHabits(db, day, false);
  const habitDone = habitList.filter((h) => h.doneToday).length;

  const goalSummaries = listGoals(db, false).filter((g) => g.status !== "completed");
  const goalAverage =
    goalSummaries.length === 0
      ? null
      : Math.round(goalSummaries.reduce((sum, g) => sum + g.progress, 0) / goalSummaries.length);
  const focusGoalSummary = goalSummaries[0] ?? null;

  const todayJournal = todayJournalOf(db, day);
  const tCounts = taskCounts(db, day);

  return {
    day,
    activitiesToday,
    tasks: tCounts,
    habits: { done: habitDone, total: habitList.length },
    goalAverage,
    activeGoals: goalSummaries.length,
    timeline: events.filter((e) => e.kind === "activity" || e.kind === "task"),
    todayJournal,
    recentJournal: recentJournalOf(db, day),
    focus: pickFocusCard({
      overdueCount: tCounts.overdue,
      hasTodayJournal: todayJournal !== null,
      hasActiveGoal: focusGoalSummary !== null,
    }),
    focusGoal: focusGoalSummary
      ? {
          id: focusGoalSummary.id,
          title: focusGoalSummary.title,
          progress: focusGoalSummary.progress,
          deadline: focusGoalSummary.deadline,
        }
      : null,
    habitList,
  };
}
