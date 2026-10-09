import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { habitLogs, habits } from "@/db/schema";
import { toFieldErrors } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { addDays, localIsoDay } from "@/lib/domain/dates";
import { calculateCompletionRate, countInCurrentPeriod } from "@/lib/domain/habit-stats";
import { calculateHabitStreak, type HabitFrequency } from "@/lib/domain/habit-streak";
import { HABIT_FREQUENCIES } from "@/config/enums";
import { habitBaseSchema, checkHabitRules, type HabitInput } from "@/schemas/habit";

export type HabitRow = typeof habits.$inferSelect;

export interface ServiceContext {
  now: () => string;
  newId: () => string;
  today: () => string;
}

const defaultContext: ServiceContext = {
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
  today: () => localIsoDay(),
};

function ctxOf(partial: Partial<ServiceContext> | undefined): ServiceContext {
  return { ...defaultContext, ...partial };
}

export interface HabitView {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  intervalCount: number;
  targetPerPeriod: number | null;
  color: string | null;
  archived: boolean;
  createdDay: string;
  /** Logged days within the trailing 84 days, newest last, for the strip and heatmap. */
  logDates: string[];
  doneToday: boolean;
  periodCount: number;
  periodTarget: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
}

const HEATMAP_DAYS = 365;

function narrowFrequency(value: string): HabitFrequency {
  const found = HABIT_FREQUENCIES.find((f) => f === value);
  if (!found) {
    throw new AppError("DB", "Stored habit has an unknown frequency.");
  }
  return found;
}

function logDatesFor(db: DbExec, habitId: string, from: string, to: string): string[] {
  return db
    .select({ date: habitLogs.date })
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), gte(habitLogs.date, from), lte(habitLogs.date, to)))
    .orderBy(asc(habitLogs.date))
    .all()
    .map((row) => row.date);
}

function createdDayOf(row: HabitRow): string {
  return row.createdAt.slice(0, 10);
}

/** Full logs (no window) are needed for streaks and rate, so the read is bounded by the habit's lifetime. */
function allLogDates(db: DbExec, habitId: string): string[] {
  return db
    .select({ date: habitLogs.date })
    .from(habitLogs)
    .where(eq(habitLogs.habitId, habitId))
    .orderBy(asc(habitLogs.date))
    .all()
    .map((row) => row.date);
}

export function toHabitView(db: DbExec, row: HabitRow, today: string): HabitView {
  const frequency = narrowFrequency(row.frequency);
  const all = allLogDates(db, row.id);
  const target = row.targetPerPeriod ?? 1;
  const streak = calculateHabitStreak({ frequency, logDates: all, today, targetPerPeriod: target });
  const recentFrom = addDays(today, -83);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency,
    intervalCount: row.intervalCount,
    targetPerPeriod: row.targetPerPeriod,
    color: row.color,
    archived: row.archived,
    createdDay: createdDayOf(row),
    logDates: all.filter((day) => day >= recentFrom && day <= today),
    doneToday: all.includes(today),
    periodCount: countInCurrentPeriod(frequency, all, today),
    periodTarget: frequency === "daily" ? 1 : target,
    currentStreak: streak.current,
    bestStreak: streak.best,
    completionRate: calculateCompletionRate({
      frequency,
      logDates: all,
      createdDay: createdDayOf(row),
      today,
      targetPerPeriod: target,
    }),
  };
}

export function listHabits(db: DbExec, today: string, includeArchived: boolean): HabitView[] {
  const rows = db
    .select()
    .from(habits)
    .where(includeArchived ? undefined : eq(habits.archived, false))
    .orderBy(asc(habits.archived), asc(habits.name))
    .all();
  return rows.map((row) => toHabitView(db, row, today));
}

export function getHabit(db: DbExec, id: string, today: string): HabitView {
  const row = db.select().from(habits).where(eq(habits.id, id)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Habit not found.");
  }
  return toHabitView(db, row, today);
}

/** Calendar heatmap cells for the last year: day → done (true/false). */
export function heatmapFor(db: DbExec, habitId: string, today: string): { day: string; done: boolean }[] {
  const from = addDays(today, -(HEATMAP_DAYS - 1));
  const done = new Set(logDatesFor(db, habitId, from, today));
  const cells: { day: string; done: boolean }[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    cells.push({ day, done: done.has(day) });
  }
  return cells;
}

function validate(input: Record<string, unknown>): HabitInput {
  const parsed = habitBaseSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", { fieldErrors: toFieldErrors(parsed.error) });
  }
  const rule = checkHabitRules(parsed.data);
  if (rule) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", { fieldErrors: { [rule.path]: [rule.message] } });
  }
  return parsed.data;
}

export function createHabit(db: Db, input: HabitInput, partial?: Partial<ServiceContext>): HabitView {
  const ctx = ctxOf(partial);
  const id = ctx.newId();
  const now = ctx.now();
  db.insert(habits)
    .values({
      id,
      name: input.name,
      description: input.description,
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      targetPerPeriod: input.targetPerPeriod,
      color: input.color,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getHabit(db, id, ctx.today());
}

export function updateHabit(db: Db, id: string, patch: Record<string, unknown>, partial?: Partial<ServiceContext>): HabitView {
  const ctx = ctxOf(partial);
  const current = db.select().from(habits).where(eq(habits.id, id)).get();
  if (!current) {
    throw new AppError("NOT_FOUND", "Habit not found.");
  }
  const input = validate({
    name: current.name,
    description: current.description,
    frequency: current.frequency,
    intervalCount: current.intervalCount,
    targetPerPeriod: current.targetPerPeriod,
    color: current.color,
    ...patch,
  });
  db.update(habits)
    .set({
      name: input.name,
      description: input.description,
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      targetPerPeriod: input.targetPerPeriod,
      color: input.color,
      updatedAt: ctx.now(),
    })
    .where(eq(habits.id, id))
    .run();
  return getHabit(db, id, ctx.today());
}

export function setHabitArchived(db: Db, id: string, archived: boolean, partial?: Partial<ServiceContext>): HabitView {
  const ctx = ctxOf(partial);
  const result = db
    .update(habits)
    .set({ archived, updatedAt: ctx.now() })
    .where(eq(habits.id, id))
    .run();
  if (result.changes === 0) {
    throw new AppError("NOT_FOUND", "Habit not found.");
  }
  return getHabit(db, id, ctx.today());
}

export function deleteHabit(db: Db, id: string): void {
  const result = db.delete(habits).where(eq(habits.id, id)).run();
  if (result.changes === 0) {
    throw new AppError("NOT_FOUND", "Habit not found.");
  }
}

/**
 * Toggles a log for a day. Backfilling past days is allowed (SDD §10 §7) but never
 * before the habit existed, and never in the future. When the client sends the
 * state it displayed, a mismatch returns the server truth instead of flipping blindly
 * (SDD §07 §3 idempotency rule).
 */
export function toggleHabitLog(
  db: Db,
  input: { habitId: string; date: string; expectedDone?: boolean },
  partial?: Partial<ServiceContext>,
): { habit: HabitView; done: boolean } {
  const ctx = ctxOf(partial);
  const today = ctx.today();
  const row = db.select().from(habits).where(eq(habits.id, input.habitId)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Habit not found.");
  }
  if (input.date > today) {
    throw new AppError("VALIDATION", "You can't log a habit for a future day.", {
      fieldErrors: { date: ["Choose today or an earlier day."] },
    });
  }
  if (input.date < createdDayOf(row)) {
    throw new AppError("VALIDATION", "This habit did not exist on that day.", {
      fieldErrors: { date: ["Choose a day on or after the habit was created."] },
    });
  }

  const existing = db
    .select({ id: habitLogs.id })
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, input.habitId), eq(habitLogs.date, input.date)))
    .get();
  const currentlyDone = existing !== undefined;

  if (input.expectedDone !== undefined && input.expectedDone !== currentlyDone) {
    return { habit: toHabitView(db, row, today), done: currentlyDone };
  }

  if (currentlyDone) {
    db.delete(habitLogs).where(eq(habitLogs.id, existing.id)).run();
  } else {
    db.insert(habitLogs)
      .values({ id: ctx.newId(), habitId: input.habitId, date: input.date, createdAt: ctx.now() })
      .run();
  }
  return { habit: toHabitView(db, row, today), done: !currentlyDone };
}
