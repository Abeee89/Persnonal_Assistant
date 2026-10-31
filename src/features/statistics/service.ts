import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { DbExec } from "@/db/client";
import { activities, categories, habitLogs, habits, journals, tasks } from "@/db/schema";
import { calculateProductivityScore } from "@/lib/domain/productivity-score";
import type { PeriodWindow } from "@/lib/domain/stats-window";

/**
 * Categories counted as "productive" for the productive-time metric (SDD §11 §3.2).
 * These are the seeded defaults. Making this user-configurable is a documented
 * Phase-2 item, not part of the MVP counters.
 */
export const PRODUCTIVE_CATEGORY_SLUGS = ["work", "study", "project", "exercise", "health"] as const;

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  count: number;
  minutes: number;
}

export interface MoodPoint {
  day: string;
  mood: number;
}

export interface StatsSnapshot {
  window: PeriodWindow;
  activityCount: number;
  totalMinutes: number;
  productiveMinutes: number;
  tasksDone: number;
  tasksDue: number;
  taskCompletionRate: number;
  journalCount: number;
  journaledDays: number;
  habitsExpected: number;
  habitsHit: number;
  habitConsistency: number;
  categoryMix: CategorySlice[];
  moodPoints: MoodPoint[];
  averageMood: number | null;
  productivityScore: number;
}

function percent(hits: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((hits / total) * 100));
}

function categoryMix(db: DbExec, from: string, to: string): CategorySlice[] {
  const rows = db
    .select({
      categoryId: activities.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
      color: categories.color,
      count: sql<number>`count(*)`,
      minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)`,
    })
    .from(activities)
    .leftJoin(categories, eq(categories.id, activities.categoryId))
    .where(and(isNull(activities.deletedAt), gte(activities.date, from), lte(activities.date, to)))
    .groupBy(activities.categoryId, categories.name, categories.color)
    .orderBy(sql`count(*) DESC`)
    .all();
  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    color: row.color,
    count: row.count,
    minutes: row.minutes,
  }));
}

function moodPoints(db: DbExec, from: string, to: string): MoodPoint[] {
  const rows = db
    .select({ day: journals.date, mood: sql<number>`round(avg(${journals.mood}))` })
    .from(journals)
    .where(
      and(
        eq(journals.type, "daily"),
        isNull(journals.deletedAt),
        gte(journals.date, from),
        lte(journals.date, to),
        sql`${journals.mood} IS NOT NULL`,
      ),
    )
    .groupBy(journals.date)
    .orderBy(journals.date)
    .all();
  return rows.map((row) => ({ day: row.day, mood: row.mood }));
}

/** Expected completions in the window across active habits, honouring frequency and target. */
function habitsExpected(db: DbExec, window: PeriodWindow): number {
  const rows = db
    .select({ frequency: habits.frequency, target: habits.targetPerPeriod })
    .from(habits)
    .where(eq(habits.archived, false))
    .all();
  let expected = 0;
  for (const habit of rows) {
    const target = habit.target ?? 1;
    if (habit.frequency === "daily") {
      expected += window.days;
    } else if (habit.frequency === "weekly") {
      expected += target * Math.max(1, Math.ceil(window.days / 7));
    } else {
      expected += target * Math.max(1, Math.ceil(window.days / 30));
    }
  }
  return expected;
}

function habitHits(db: DbExec, from: string, to: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(habitLogs)
    .where(and(gte(habitLogs.date, from), lte(habitLogs.date, to)))
    .get();
  return row?.n ?? 0;
}

export function buildStats(db: DbExec, window: PeriodWindow): StatsSnapshot {
  const { from, to } = window;

  const activityAgg = db
    .select({
      count: sql<number>`count(*)`,
      minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)`,
    })
    .from(activities)
    .where(and(isNull(activities.deletedAt), gte(activities.date, from), lte(activities.date, to)))
    .get();

  const productiveAgg = db
    .select({ minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)` })
    .from(activities)
    .innerJoin(categories, eq(categories.id, activities.categoryId))
    .where(
      and(
        isNull(activities.deletedAt),
        gte(activities.date, from),
        lte(activities.date, to),
        inArray(activities.status, ["done", "in_progress"]),
        inArray(categories.slug, [...PRODUCTIVE_CATEGORY_SLUGS]),
      ),
    )
    .get();

  const activitiesDone =
    db
      .select({ n: sql<number>`count(*)` })
      .from(activities)
      .where(
        and(
          isNull(activities.deletedAt),
          gte(activities.date, from),
          lte(activities.date, to),
          eq(activities.status, "done"),
        ),
      )
      .get()?.n ?? 0;

  const tasksDone = db
    .select({ n: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "done"),
        sql`${tasks.completedAt} IS NOT NULL`,
        sql`substr(${tasks.completedAt}, 1, 10) >= ${from}`,
        sql`substr(${tasks.completedAt}, 1, 10) <= ${to}`,
      ),
    )
    .get()?.n ?? 0;

  const tasksDue = db
    .select({ n: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} IS NOT NULL`,
        gte(tasks.dueDate, from),
        lte(tasks.dueDate, to),
        sql`${tasks.status} != 'cancelled'`,
      ),
    )
    .get()?.n ?? 0;

  const journalAgg = db
    .select({ count: sql<number>`count(*)`, days: sql<number>`count(distinct ${journals.date})` })
    .from(journals)
    .where(
      and(eq(journals.type, "daily"), isNull(journals.deletedAt), gte(journals.date, from), lte(journals.date, to)),
    )
    .get();

  const journalCount = journalAgg?.count ?? 0;
  const journaledDays = journalAgg?.days ?? 0;
  const expectedHabits = habitsExpected(db, window);
  const hits = habitHits(db, from, to);
  const points = moodPoints(db, from, to);
  const averageMood =
    points.length === 0 ? null : Math.round((points.reduce((sum, p) => sum + p.mood, 0) / points.length) * 10) / 10;

  return {
    window,
    activityCount: activityAgg?.count ?? 0,
    totalMinutes: activityAgg?.minutes ?? 0,
    productiveMinutes: productiveAgg?.minutes ?? 0,
    tasksDone,
    tasksDue,
    taskCompletionRate: percent(tasksDone, tasksDue),
    journalCount,
    journaledDays,
    habitsExpected: expectedHabits,
    habitsHit: hits,
    habitConsistency: percent(hits, expectedHabits),
    categoryMix: categoryMix(db, from, to),
    moodPoints: points,
    averageMood,
    productivityScore: calculateProductivityScore({
      tasksDone,
      tasksDue,
      activitiesDone,
      activitiesPlanned: activityAgg?.count ?? 0,
      habitsHit: hits,
      habitsExpected: expectedHabits,
      journaledDays,
      windowDays: window.days,
    }),
  };
}
