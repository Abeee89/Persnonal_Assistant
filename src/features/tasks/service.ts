import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { activities, categories, goals, taskTags, tags, tasks } from "@/db/schema";
import { AppError, type FieldErrors } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { slugify } from "@/schemas/common";
import { TASK_STATUSES } from "@/config/enums";
import { taskUpdateSchema, type TaskInput } from "@/schemas/task";
import { toFieldErrors } from "@/lib/action";
import { assignLane, LANES, type Lane } from "@/lib/domain/task-lanes";

export type TaskRow = typeof tasks.$inferSelect;
export type TaskStatus = (typeof TASK_STATUSES)[number];

function narrowStatus(value: string): TaskStatus {
  const found = TASK_STATUSES.find((status) => status === value);
  if (!found) {
    throw new AppError("DB", "Stored task has an unknown status.");
  }
  return found;
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  categoryId: string | null;
  goalId: string | null;
  goalTitle: string | null;
  activityId: string | null;
  tags: string[];
  completedAt: string | null;
  lane: Lane | null;
  updatedAt: string;
}

export interface ServiceContext {
  now: () => string;
  newId: () => string;
  today: () => string;
}

const defaultContext: ServiceContext = {
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
  today: () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
};

function ctxOf(partial: Partial<ServiceContext> | undefined): ServiceContext {
  return { ...defaultContext, ...partial };
}

const NOT_FOUND = "Task not found.";

function tagNamesFor(db: DbExec, taskIds: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (taskIds.length === 0) {
    return out;
  }
  const rows = db
    .select({ taskId: taskTags.taskId, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, [...taskIds]))
    .orderBy(asc(tags.name))
    .all();
  for (const row of rows) {
    const bucket = out.get(row.taskId);
    if (bucket) {
      bucket.push(row.name);
    } else {
      out.set(row.taskId, [row.name]);
    }
  }
  return out;
}

function toView(row: TaskRow, tagNames: string[], goalTitle: string | null, today: string): TaskView {
  const status = narrowStatus(row.status);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    priority: row.priority,
    dueDate: row.dueDate,
    categoryId: row.categoryId,
    goalId: row.goalId,
    goalTitle,
    activityId: row.activityId,
    tags: tagNames,
    completedAt: row.completedAt,
    lane: assignLane({ status, dueDate: row.dueDate, completedAt: row.completedAt }, today),
    updatedAt: row.updatedAt,
  };
}

function goalTitles(db: DbExec, ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (ids.length === 0) {
    return out;
  }
  for (const row of db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(inArray(goals.id, [...ids]))
    .all()) {
    out.set(row.id, row.title);
  }
  return out;
}

function viewsFor(db: DbExec, rows: TaskRow[], today: string): TaskView[] {
  const tagMap = tagNamesFor(db, rows.map((r) => r.id));
  const titles = goalTitles(db, rows.flatMap((r) => (r.goalId ? [r.goalId] : [])));
  return rows.map((row) =>
    toView(row, tagMap.get(row.id) ?? [], row.goalId ? (titles.get(row.goalId) ?? null) : null, today),
  );
}

export function getTask(db: DbExec, id: string, today: string): TaskView {
  const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!row) {
    throw new AppError("NOT_FOUND", NOT_FOUND);
  }
  return viewsFor(db, [row], today)[0] as TaskView;
}

/** All tasks that can appear in a lane: open tasks plus recently completed ones. */
export function listTaskLanes(db: DbExec, today: string): Record<Lane, TaskView[]> {
  const rows = db.select().from(tasks).where(inArray(tasks.status, ["todo", "in_progress", "done"])).all();
  const views = viewsFor(db, rows, today);
  const grouped: Record<Lane, TaskView[]> = { overdue: [], today: [], week: [], someday: [], done: [] };
  for (const view of views) {
    if (view.lane) {
      grouped[view.lane].push(view);
    }
  }
  for (const lane of LANES) {
    grouped[lane].sort(compareTasks);
  }
  return grouped;
}

function compareTasks(a: TaskView, b: TaskView): number {
  const dueA = a.dueDate ?? "9999-12-31";
  const dueB = b.dueDate ?? "9999-12-31";
  if (dueA !== dueB) {
    return dueA < dueB ? -1 : 1;
  }
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

function refsError(errors: FieldErrors): never {
  throw new AppError("VALIDATION", "Please fix the highlighted fields.", { fieldErrors: errors });
}

function assertRefs(db: DbExec, refs: { categoryId: string | null; goalId: string | null; activityId: string | null }): void {
  const errors: FieldErrors = {};
  if (refs.categoryId !== null && !db.select({ id: categories.id }).from(categories).where(eq(categories.id, refs.categoryId)).get()) {
    errors.categoryId = ["Category not found."];
  }
  if (refs.goalId !== null && !db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, refs.goalId), isNull(goals.deletedAt))).get()) {
    errors.goalId = ["Goal not found."];
  }
  if (refs.activityId !== null && !db.select({ id: activities.id }).from(activities).where(and(eq(activities.id, refs.activityId), isNull(activities.deletedAt))).get()) {
    errors.activityId = ["Activity not found."];
  }
  if (Object.keys(errors).length > 0) {
    refsError(errors);
  }
}

function writeTags(db: DbExec, taskId: string, names: readonly string[], ctx: ServiceContext): void {
  db.delete(taskTags).where(eq(taskTags.taskId, taskId)).run();
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
    db.insert(taskTags).values({ taskId, tagId: tag.id }).onConflictDoNothing().run();
  }
}

/** Completion rules (SDD §10 §5): done sets completedAt; reopening clears it. */
function completionFields(status: TaskStatus, previous: TaskStatus | null, now: string, previousCompletedAt: string | null) {
  if (status === "done") {
    return { completedAt: previous === "done" && previousCompletedAt ? previousCompletedAt : now };
  }
  return { completedAt: null };
}

export function createTask(db: Db, input: TaskInput, partial?: Partial<ServiceContext>): TaskView {
  const ctx = ctxOf(partial);
  assertRefs(db, input);
  const id = ctx.newId();
  const now = ctx.now();
  db.transaction((tx) => {
    tx.insert(tasks)
      .values({
        id,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        categoryId: input.categoryId,
        goalId: input.goalId,
        activityId: input.activityId,
        sortOrder: 0,
        ...completionFields(input.status, null, now, null),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    writeTags(tx, id, input.tags, ctx);
  });
  return getTask(db, id, ctx.today());
}

export function updateTask(db: Db, id: string, patch: Record<string, unknown>, partial?: Partial<ServiceContext>): TaskView {
  const ctx = ctxOf(partial);
  const current = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!current) {
    throw new AppError("NOT_FOUND", NOT_FOUND);
  }
  const currentTags = tagNamesFor(db, [id]).get(id) ?? [];
  const merged = {
    title: current.title,
    description: current.description,
    status: current.status,
    priority: current.priority,
    dueDate: current.dueDate,
    categoryId: current.categoryId,
    goalId: current.goalId,
    activityId: current.activityId,
    tags: currentTags,
    ...patch,
  };
  const parsed = taskUpdateSchema.shape.patch.safeParse(merged);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }
  const input = parsed.data as TaskInput;
  assertRefs(db, input);
  const now = ctx.now();
  db.transaction((tx) => {
    tx.update(tasks)
      .set({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        categoryId: input.categoryId,
        goalId: input.goalId,
        activityId: input.activityId,
        ...completionFields(input.status, narrowStatus(current.status), now, current.completedAt),
        updatedAt: now,
      })
      .where(eq(tasks.id, id))
      .run();
    if (patch.tags !== undefined) {
      writeTags(tx, id, input.tags, ctx);
    }
  });
  return getTask(db, id, ctx.today());
}

export function setTaskStatus(db: Db, id: string, status: TaskStatus, partial?: Partial<ServiceContext>): TaskView {
  return updateTask(db, id, { status }, partial);
}

export function deleteTask(db: Db, id: string): void {
  const result = db.delete(tasks).where(eq(tasks.id, id)).run();
  if (result.changes === 0) {
    throw new AppError("NOT_FOUND", NOT_FOUND);
  }
}
