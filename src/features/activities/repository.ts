import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { DbExec } from "@/db/client";
import { activities, activityTags, categories, goals, tags } from "@/db/schema";
import { slugify } from "@/schemas/common";

export type ActivityRow = typeof activities.$inferSelect;
export type NewActivityRow = typeof activities.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;

export interface ActivityQueryOptions {
  from: string | null;
  to: string | null;
  categoryId: string | null;
  status: string | null;
  priority: string | null;
  q: string | null;
  sort: "date_asc" | "date_desc";
  cursor: { date: string; id: string } | null;
  take: number;
}

export function insertActivityRow(db: DbExec, row: NewActivityRow): void {
  db.insert(activities).values(row).run();
}

export function updateActivityRow(db: DbExec, id: string, values: Partial<NewActivityRow>): void {
  db.update(activities).set(values).where(eq(activities.id, id)).run();
}

export function findAnyActivityRow(db: DbExec, id: string): ActivityRow | undefined {
  return db.select().from(activities).where(eq(activities.id, id)).get();
}

export function findAliveActivityRow(db: DbExec, id: string): ActivityRow | undefined {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), isNull(activities.deletedAt)))
    .get();
}

export function categoryExists(db: DbExec, id: string): boolean {
  return db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).get() !== undefined;
}

export function goalIsAlive(db: DbExec, id: string): boolean {
  return db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, id), isNull(goals.deletedAt))).get() !== undefined;
}

export function listCategoryRows(db: DbExec): CategoryRow[] {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)).all();
}

/** Returns tag ids keyed by slug, creating any tag that does not exist yet. */
export function upsertTagRows(
  db: DbExec,
  names: readonly string[],
  now: string,
  newId: () => string,
): string[] {
  const ids = new Set<string>();
  for (const name of names) {
    const slug = slugify(name);
    if (slug === "") {
      continue;
    }
    const existing = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (existing) {
      ids.add(existing.id);
      continue;
    }
    const id = newId();
    db.insert(tags).values({ id, name, slug, createdAt: now }).run();
    ids.add(id);
  }
  return [...ids];
}

export function replaceActivityTags(db: DbExec, activityId: string, tagIds: readonly string[]): void {
  db.delete(activityTags).where(eq(activityTags.activityId, activityId)).run();
  if (tagIds.length > 0) {
    db.insert(activityTags)
      .values(tagIds.map((tagId) => ({ activityId, tagId })))
      .run();
  }
}

export function tagNamesByActivity(db: DbExec, activityIds: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (activityIds.length === 0) {
    return out;
  }
  const rows = db
    .select({ activityId: activityTags.activityId, name: tags.name })
    .from(activityTags)
    .innerJoin(tags, eq(tags.id, activityTags.tagId))
    .where(inArray(activityTags.activityId, [...activityIds]))
    .orderBy(asc(tags.name))
    .all();
  for (const row of rows) {
    const bucket = out.get(row.activityId);
    if (bucket) {
      bucket.push(row.name);
    } else {
      out.set(row.activityId, [row.name]);
    }
  }
  return out;
}

export function selectActivityRows(db: DbExec, options: ActivityQueryOptions): ActivityRow[] {
  const conditions: SQL[] = [isNull(activities.deletedAt)];
  if (options.from !== null) {
    conditions.push(gte(activities.date, options.from));
  }
  if (options.to !== null) {
    conditions.push(lte(activities.date, options.to));
  }
  if (options.categoryId !== null) {
    conditions.push(eq(activities.categoryId, options.categoryId));
  }
  if (options.status !== null) {
    conditions.push(eq(activities.status, options.status));
  }
  if (options.priority !== null) {
    conditions.push(eq(activities.priority, options.priority));
  }
  if (options.q !== null) {
    const needle = options.q;
    conditions.push(
      sql`(instr(lower(${activities.title}), lower(${needle})) > 0 OR instr(lower(coalesce(${activities.description}, '')), lower(${needle})) > 0)`,
    );
  }
  if (options.cursor !== null) {
    const { date, id } = options.cursor;
    const op = options.sort === "date_desc" ? sql.raw("<") : sql.raw(">");
    conditions.push(
      sql`(${activities.date} ${op} ${date} OR (${activities.date} = ${date} AND ${activities.id} ${op} ${id}))`,
    );
  }

  const descending = options.sort === "date_desc";
  return db
    .select()
    .from(activities)
    .where(and(...conditions))
    .orderBy(
      descending ? desc(activities.date) : asc(activities.date),
      descending ? desc(activities.id) : asc(activities.id),
    )
    .limit(options.take)
    .all();
}

