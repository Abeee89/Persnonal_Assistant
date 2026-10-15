import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { activities, categories, goalTags, goals, milestones, tags, tasks } from "@/db/schema";
import { toFieldErrors } from "@/lib/action";
import { AppError, type FieldErrors } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { calculateGoalProgress } from "@/lib/domain/goal-progress";
import { reconcileGoalStatus, type GoalStatus } from "@/lib/domain/goal-status";
import { slugify } from "@/schemas/common";
import { goalBaseSchema, type goalInputSchema, type milestoneInputSchema } from "@/schemas/goal";
import { GOAL_STATUSES, PROGRESS_MODES } from "@/config/enums";

export type GoalRow = typeof goals.$inferSelect;

export interface MilestoneView {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  sortOrder: number;
  completedAt: string | null;
}

export interface LinkedTaskView {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface LinkedActivityView {
  id: string;
  title: string;
  date: string;
  status: string;
}

export interface GoalView {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  priority: string;
  status: GoalStatus;
  progressMode: "auto" | "manual";
  manualProgress: number | null;
  progress: number;
  startDate: string | null;
  deadline: string | null;
  tags: string[];
  milestones: MilestoneView[];
  tasks: LinkedTaskView[];
  activities: LinkedActivityView[];
  updatedAt: string;
}

export interface GoalSummary {
  id: string;
  title: string;
  status: GoalStatus;
  progress: number;
  deadline: string | null;
  milestoneTotal: number;
  milestoneDone: number;
}

export interface ServiceContext {
  now: () => string;
  newId: () => string;
}

const defaultContext: ServiceContext = {
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
};

function ctxOf(partial: Partial<ServiceContext> | undefined): ServiceContext {
  return { ...defaultContext, ...partial };
}

const NOT_FOUND = "Goal not found.";

function narrowStatus(value: string): GoalStatus {
  const found = GOAL_STATUSES.find((status) => status === value);
  if (!found) {
    throw new AppError("DB", "Stored goal has an unknown status.");
  }
  return found;
}

function narrowMode(value: string): "auto" | "manual" {
  const found = PROGRESS_MODES.find((mode) => mode === value);
  if (!found) {
    throw new AppError("DB", "Stored goal has an unknown progress mode.");
  }
  return found;
}

function aliveRow(db: DbExec, id: string): GoalRow {
  const row = db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
    .get();
  if (!row) {
    throw new AppError("NOT_FOUND", NOT_FOUND);
  }
  return row;
}

function milestoneRows(db: DbExec, goalId: string): MilestoneView[] {
  return db
    .select()
    .from(milestones)
    .where(eq(milestones.goalId, goalId))
    .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      dueDate: row.dueDate,
      sortOrder: row.sortOrder,
      completedAt: row.completedAt,
    }));
}

function tagNames(db: DbExec, goalId: string): string[] {
  return db
    .select({ name: tags.name })
    .from(goalTags)
    .innerJoin(tags, eq(tags.id, goalTags.tagId))
    .where(eq(goalTags.goalId, goalId))
    .orderBy(asc(tags.name))
    .all()
    .map((row) => row.name);
}

function linkedTasks(db: DbExec, goalId: string): LinkedTaskView[] {
  return db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(eq(tasks.goalId, goalId))
    .orderBy(asc(tasks.dueDate), asc(tasks.title))
    .all();
}

function linkedActivities(db: DbExec, goalId: string): LinkedActivityView[] {
  return db
    .select({ id: activities.id, title: activities.title, date: activities.date, status: activities.status })
    .from(activities)
    .where(and(eq(activities.goalId, goalId), isNull(activities.deletedAt)))
    .orderBy(sql`${activities.date} DESC`, asc(activities.title))
    .all();
}

function toView(db: DbExec, row: GoalRow): GoalView {
  const ms = milestoneRows(db, row.id);
  const status = narrowStatus(row.status);
  const mode = narrowMode(row.progressMode);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    priority: row.priority,
    status,
    progressMode: mode,
    manualProgress: row.manualProgress,
    progress: calculateGoalProgress({
      progressMode: mode,
      manualProgress: row.manualProgress,
      milestones: ms,
    }),
    startDate: row.startDate,
    deadline: row.deadline,
    tags: tagNames(db, row.id),
    milestones: ms,
    tasks: linkedTasks(db, row.id),
    activities: linkedActivities(db, row.id),
    updatedAt: row.updatedAt,
  };
}

export function getGoal(db: DbExec, id: string): GoalView {
  return toView(db, aliveRow(db, id));
}

export function listGoals(db: DbExec, includeArchived: boolean): GoalSummary[] {
  const rows = db
    .select()
    .from(goals)
    .where(
      includeArchived
        ? isNull(goals.deletedAt)
        : and(isNull(goals.deletedAt), sql`${goals.status} != 'archived'`),
    )
    .orderBy(sql`${goals.deadline} IS NULL`, asc(goals.deadline), asc(goals.title))
    .all();
  return rows.map((row) => {
    const ms = milestoneRows(db, row.id);
    const mode = narrowMode(row.progressMode);
    return {
      id: row.id,
      title: row.title,
      status: narrowStatus(row.status),
      progress: calculateGoalProgress({ progressMode: mode, manualProgress: row.manualProgress, milestones: ms }),
      deadline: row.deadline,
      milestoneTotal: ms.length,
      milestoneDone: ms.filter((m) => m.done).length,
    };
  });
}

function assertRefs(db: DbExec, categoryId: string | null): void {
  if (categoryId === null) {
    return;
  }
  const exists = db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get();
  if (!exists) {
    const errors: FieldErrors = { categoryId: ["Category not found."] };
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", { fieldErrors: errors });
  }
}

function writeTags(db: DbExec, goalId: string, names: readonly string[], ctx: ServiceContext): void {
  db.delete(goalTags).where(eq(goalTags.goalId, goalId)).run();
  for (const name of names) {
    const slug = slugify(name);
    if (slug === "") {
      continue;
    }
    let tag = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (!tag) {
      const id = ctx.newId();
      db.insert(tags).values({ id, name, slug, createdAt: ctx.now() }).run();
      tag = { id };
    }
    db.insert(goalTags).values({ goalId, tagId: tag.id }).onConflictDoNothing().run();
  }
}

/**
 * Recomputes auto-status after any milestone or mode change and persists it when it
 * moved. Keeps the stored status consistent with progress (SDD §10 §2).
 */
function syncStatus(db: DbExec, goalId: string, now: string): void {
  const row = db.select().from(goals).where(eq(goals.id, goalId)).get();
  if (!row) {
    return;
  }
  const ms = milestoneRows(db, goalId);
  const progress = calculateGoalProgress({
    progressMode: narrowMode(row.progressMode),
    manualProgress: row.manualProgress,
    milestones: ms,
  });
  const next = reconcileGoalStatus({
    status: narrowStatus(row.status),
    progressMode: narrowMode(row.progressMode),
    progress,
  });
  if (next !== row.status) {
    db.update(goals).set({ status: next, updatedAt: now }).where(eq(goals.id, goalId)).run();
  }
}

export function createGoal(db: Db, input: ReturnType<typeof goalInputSchema.parse>, partial?: Partial<ServiceContext>): GoalView {
  const ctx = ctxOf(partial);
  assertRefs(db, input.categoryId);
  const id = ctx.newId();
  const now = ctx.now();
  db.transaction((tx) => {
    tx.insert(goals)
      .values({
        id,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        priority: input.priority,
        status: input.status,
        progressMode: input.progressMode,
        manualProgress: input.manualProgress,
        startDate: input.startDate,
        deadline: input.deadline,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    writeTags(tx, id, input.tags, ctx);
  });
  return getGoal(db, id);
}

export function updateGoal(db: Db, id: string, patch: Record<string, unknown>, partial?: Partial<ServiceContext>): GoalView {
  const ctx = ctxOf(partial);
  const current = aliveRow(db, id);
  const merged = {
    title: current.title,
    description: current.description,
    categoryId: current.categoryId,
    priority: current.priority,
    status: current.status,
    progressMode: current.progressMode,
    manualProgress: current.manualProgress,
    startDate: current.startDate,
    deadline: current.deadline,
    tags: tagNames(db, id),
    ...patch,
  };
  const parsed = goalBaseSchema.superRefine((value, ctxZ) => {
    if (value.startDate !== null && value.deadline !== null && value.deadline < value.startDate) {
      ctxZ.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be on or after the start date." });
    }
    if (value.progressMode === "manual" && value.manualProgress === null) {
      ctxZ.addIssue({ code: "custom", path: ["manualProgress"], message: "Set a progress value for manual mode." });
    }
  }).safeParse(merged);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;
  assertRefs(db, input.categoryId);
  const now = ctx.now();
  db.transaction((tx) => {
    tx.update(goals)
      .set({
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        priority: input.priority,
        status: input.status,
        progressMode: input.progressMode,
        manualProgress: input.manualProgress,
        startDate: input.startDate,
        deadline: input.deadline,
        updatedAt: now,
      })
      .where(eq(goals.id, id))
      .run();
    if (patch.tags !== undefined) {
      writeTags(tx, id, input.tags, ctx);
    }
    syncStatus(tx, id, now);
  });
  return getGoal(db, id);
}

export function softDeleteGoal(db: Db, id: string, partial?: Partial<ServiceContext>): void {
  const ctx = ctxOf(partial);
  aliveRow(db, id);
  const now = ctx.now();
  db.update(goals).set({ deletedAt: now, updatedAt: now }).where(eq(goals.id, id)).run();
}

export function addMilestone(db: Db, input: ReturnType<typeof milestoneInputSchema.parse>, partial?: Partial<ServiceContext>): GoalView {
  const ctx = ctxOf(partial);
  aliveRow(db, input.goalId);
  const now = ctx.now();
  const nextOrder = (db
    .select({ max: sql<number>`coalesce(max(${milestones.sortOrder}), -1)` })
    .from(milestones)
    .where(eq(milestones.goalId, input.goalId))
    .get()?.max ?? -1) + 1;
  db.transaction((tx) => {
    tx.insert(milestones)
      .values({
        id: ctx.newId(),
        goalId: input.goalId,
        title: input.title,
        dueDate: input.dueDate,
        sortOrder: nextOrder,
        done: false,
        createdAt: now,
      })
      .run();
    syncStatus(tx, input.goalId, now);
  });
  return getGoal(db, input.goalId);
}

export function toggleMilestone(db: Db, id: string, done: boolean, partial?: Partial<ServiceContext>): GoalView {
  const ctx = ctxOf(partial);
  const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Milestone not found.");
  }
  aliveRow(db, row.goalId);
  const now = ctx.now();
  db.transaction((tx) => {
    tx.update(milestones)
      .set({ done, completedAt: done ? now : null })
      .where(eq(milestones.id, id))
      .run();
    syncStatus(tx, row.goalId, now);
  });
  return getGoal(db, row.goalId);
}

export function deleteMilestone(db: Db, id: string, partial?: Partial<ServiceContext>): GoalView {
  const ctx = ctxOf(partial);
  const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Milestone not found.");
  }
  const now = ctx.now();
  db.transaction((tx) => {
    tx.delete(milestones).where(eq(milestones.id, id)).run();
    syncStatus(tx, row.goalId, now);
  });
  return getGoal(db, row.goalId);
}

export function linkedGoalExists(db: DbExec, goalId: string): boolean {
  return (
    db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, goalId), isNull(goals.deletedAt)))
      .get() !== undefined
  );
}
