import type { Db, DbExec } from "@/db/client";
import { toFieldErrors } from "@/lib/action";
import { AppError, type FieldErrors } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { calculateDuration } from "@/lib/domain/duration";
import { activityInputSchema, type ActivityInput, type ActivityListQuery } from "@/schemas/activity";
import {
  categoryExists,
  findAliveActivityRow,
  findAnyActivityRow,
  goalIsAlive,
  insertActivityRow,
  listCategoryRows,
  replaceActivityTags,
  selectActivityRows,
  tagNamesByActivity,
  type ActivityRow,
  updateActivityRow,
  upsertTagRows,
} from "./repository";

export type ActivityStatus = ActivityInput["status"];

export interface ActivityView {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  goalId: string | null;
  sourceActivityId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  allDay: boolean;
  status: ActivityStatus;
  priority: ActivityInput["priority"];
  location: string | null;
  mood: number | null;
  energyLevel: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityPage {
  items: ActivityView[];
  nextCursor: string | null;
}

export interface ServiceContext {
  now: () => string;
  newId: () => string;
}

export type ServiceOptions = Partial<ServiceContext> & { sourceActivityId?: string | null };

const defaultContext: ServiceContext = {
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
};

function resolveContext(options: Partial<ServiceContext> | undefined): ServiceContext {
  return { ...defaultContext, ...options };
}

const NOT_FOUND_MESSAGE = "Activity not found.";

export function toActivityView(row: ActivityRow, tagNames: string[]): ActivityView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    goalId: row.goalId,
    sourceActivityId: row.sourceActivityId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    allDay: row.allDay,
    status: row.status as ActivityStatus,
    priority: row.priority as ActivityInput["priority"],
    location: row.location,
    mood: row.mood,
    energyLevel: row.energyLevel,
    tags: tagNames,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Derived timing values (SDD §06 §6): duration snapshot and ordering epoch. */
export function deriveTiming(input: Pick<ActivityInput, "date" | "startTime" | "endTime" | "allDay">): {
  durationMinutes: number | null;
  startEpoch: number | null;
} {
  if (input.allDay || input.startTime === null) {
    return { durationMinutes: null, startEpoch: null };
  }
  const durationMinutes =
    input.endTime === null ? null : calculateDuration(input.startTime, input.endTime);
  return {
    durationMinutes,
    startEpoch: new Date(`${input.date}T${input.startTime}:00`).getTime(),
  };
}

function assertReferences(
  db: DbExec,
  refs: { categoryId: string | null; goalId: string | null },
): void {
  const errors: FieldErrors = {};
  if (refs.categoryId !== null && !categoryExists(db, refs.categoryId)) {
    errors.categoryId = ["Category not found."];
  }
  if (refs.goalId !== null && !goalIsAlive(db, refs.goalId)) {
    errors.goalId = ["Goal not found."];
  }
  if (Object.keys(errors).length > 0) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", { fieldErrors: errors });
  }
}

function writeTags(db: DbExec, activityId: string, names: readonly string[], ctx: ServiceContext): void {
  const tagIds = upsertTagRows(db, names, ctx.now(), ctx.newId);
  replaceActivityTags(db, activityId, tagIds);
}

function requireAliveRow(db: DbExec, id: string): ActivityRow {
  const row = findAliveActivityRow(db, id);
  if (!row) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  return row;
}

function loadView(db: DbExec, row: ActivityRow): ActivityView {
  const names = tagNamesByActivity(db, [row.id]).get(row.id) ?? [];
  return toActivityView(row, names);
}

export function findActivity(db: DbExec, id: string): ActivityView | null {
  const row = findAliveActivityRow(db, id);
  return row ? loadView(db, row) : null;
}

export function getActivity(db: DbExec, id: string): ActivityView {
  const view = findActivity(db, id);
  if (!view) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  return view;
}

export function createActivity(db: Db, input: ActivityInput, options: ServiceOptions = {}): ActivityView {
  const ctx = resolveContext(options);
  assertReferences(db, input);
  const id = ctx.newId();
  const now = ctx.now();
  const timing = deriveTiming(input);

  db.transaction((tx) => {
    insertActivityRow(tx, {
      id,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      goalId: input.goalId,
      sourceActivityId: options.sourceActivityId ?? null,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      startEpoch: timing.startEpoch,
      durationMinutes: timing.durationMinutes,
      allDay: input.allDay,
      status: input.status,
      priority: input.priority,
      location: input.location,
      mood: input.mood,
      energyLevel: input.energyLevel,
      createdAt: now,
      updatedAt: now,
    });
    writeTags(tx, id, input.tags, ctx);
  });

  return getActivity(db, id);
}

export type ActivityPatch = Partial<ActivityInput>;

function definedEntries<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function updateActivity(
  db: Db,
  id: string,
  patch: ActivityPatch,
  options: Partial<ServiceContext> = {},
): ActivityView {
  const ctx = resolveContext(options);
  const current = loadView(db, requireAliveRow(db, id));

  const merged: Record<string, unknown> = {
    title: current.title,
    description: current.description,
    categoryId: current.categoryId,
    goalId: current.goalId,
    date: current.date,
    startTime: current.startTime,
    endTime: current.endTime,
    allDay: current.allDay,
    status: current.status,
    priority: current.priority,
    location: current.location,
    mood: current.mood,
    energyLevel: current.energyLevel,
    tags: current.tags,
    ...definedEntries(patch),
  };

  const parsed = activityInputSchema.safeParse(merged);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: toFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;
  assertReferences(db, input);
  const timing = deriveTiming(input);

  db.transaction((tx) => {
    updateActivityRow(tx, id, {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      goalId: input.goalId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      startEpoch: timing.startEpoch,
      durationMinutes: timing.durationMinutes,
      allDay: input.allDay,
      status: input.status,
      priority: input.priority,
      location: input.location,
      mood: input.mood,
      energyLevel: input.energyLevel,
      updatedAt: ctx.now(),
    });
    if (patch.tags !== undefined) {
      writeTags(tx, id, input.tags, ctx);
    }
  });

  return getActivity(db, id);
}

export function setActivityStatus(
  db: Db,
  id: string,
  status: ActivityStatus,
  options: Partial<ServiceContext> = {},
): ActivityView {
  return updateActivity(db, id, { status }, options);
}

export function duplicateActivity(
  db: Db,
  id: string,
  date: string,
  options: Partial<ServiceContext> = {},
): ActivityView {
  const source = getActivity(db, id);
  return createActivity(
    db,
    {
      title: source.title,
      description: source.description,
      categoryId: source.categoryId,
      goalId: source.goalId,
      date,
      startTime: null,
      endTime: null,
      allDay: source.allDay,
      status: "planned",
      priority: source.priority,
      location: source.location,
      mood: null,
      energyLevel: null,
      tags: source.tags,
    },
    { ...options, sourceActivityId: source.id },
  );
}

export function deleteActivity(db: Db, id: string, options: Partial<ServiceContext> = {}): void {
  const ctx = resolveContext(options);
  requireAliveRow(db, id);
  const now = ctx.now();
  updateActivityRow(db, id, { deletedAt: now, updatedAt: now });
}

export function restoreActivity(db: Db, id: string, options: Partial<ServiceContext> = {}): ActivityView {
  const ctx = resolveContext(options);
  const row = findAnyActivityRow(db, id);
  if (!row || row.deletedAt === null) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  updateActivityRow(db, id, { deletedAt: null, updatedAt: ctx.now() });
  return getActivity(db, id);
}

const CURSOR_SEPARATOR = "|";

export function encodeCursor(date: string, id: string): string {
  return Buffer.from(`${date}${CURSOR_SEPARATOR}${id}`, "utf8").toString("base64url");
}

export function decodeCursor(value: string): { date: string; id: string } {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const [date, id, extra] = decoded.split(CURSOR_SEPARATOR);
  if (!date || !id || extra !== undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: { cursor: ["Invalid page cursor."] },
    });
  }
  return { date, id };
}

export function listActivities(db: DbExec, query: ActivityListQuery): ActivityPage {
  const sort = query.sort === "date_asc" ? "date_asc" : "date_desc";
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const rows = selectActivityRows(db, {
    from: query.from,
    to: query.to,
    categoryId: query.categoryId,
    status: query.status,
    priority: query.priority,
    q: query.q,
    sort,
    cursor,
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const names = tagNamesByActivity(
    db,
    page.map((row) => row.id),
  );
  const items = page.map((row) => toActivityView(row, names.get(row.id) ?? []));
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.date, last.id) : null;
  return { items, nextCursor };
}

export function listCategories(db: DbExec): { id: string; name: string; color: string | null }[] {
  return listCategoryRows(db).map((row) => ({ id: row.id, name: row.name, color: row.color }));
}
