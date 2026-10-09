import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { journals, journalTags, tags } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { EMPTY_DOC, extractPlainText } from "@/lib/domain/tiptap-text";
import { slugify } from "@/schemas/common";
import { bindAttachments } from "@/features/attachments/service";
import type { JournalUpsertInput } from "@/schemas/journal";

export type JournalRow = typeof journals.$inferSelect;

export interface JournalView {
  id: string;
  date: string;
  type: "daily" | "weekly" | "monthly";
  mood: number | null;
  energyLevel: number | null;
  contentJson: string;
  contentPlain: string;
  whatHappened: string | null;
  accomplished: string | null;
  wentWell: string | null;
  didNotGoWell: string | null;
  learned: string | null;
  improveTomorrow: string | null;
  gratitude: string | null;
  notes: string | null;
  private: boolean;
  status: "draft" | "final";
  tags: string[];
  updatedAt: string;
}

export interface JournalSummary {
  id: string;
  date: string;
  mood: number | null;
  preview: string;
  status: "draft" | "final";
  updatedAt: string;
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

export function toJournalView(row: JournalRow, tagNames: string[]): JournalView {
  return {
    id: row.id,
    date: row.date,
    type: row.type as JournalView["type"],
    mood: row.mood,
    energyLevel: row.energyLevel,
    contentJson: row.contentJson,
    contentPlain: row.contentPlain,
    whatHappened: row.whatHappened,
    accomplished: row.accomplished,
    wentWell: row.wentWell,
    didNotGoWell: row.didNotGoWell,
    learned: row.learned,
    improveTomorrow: row.improveTomorrow,
    gratitude: row.gratitude,
    notes: row.notes,
    private: row.private,
    status: row.status as JournalView["status"],
    tags: tagNames,
    updatedAt: row.updatedAt,
  };
}

function aliveDailyRow(db: DbExec, date: string): JournalRow | undefined {
  return db
    .select()
    .from(journals)
    .where(and(eq(journals.date, date), eq(journals.type, "daily"), isNull(journals.deletedAt)))
    .get();
}

function tagNamesFor(db: DbExec, journalId: string): string[] {
  return db
    .select({ name: tags.name })
    .from(journalTags)
    .innerJoin(tags, eq(tags.id, journalTags.tagId))
    .where(eq(journalTags.journalId, journalId))
    .orderBy(asc(tags.name))
    .all()
    .map((row) => row.name);
}

export function getDailyEntry(db: DbExec, date: string): JournalView | null {
  const row = aliveDailyRow(db, date);
  return row ? toJournalView(row, tagNamesFor(db, row.id)) : null;
}

export function getEntryById(db: DbExec, id: string): JournalView | null {
  const row = db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), isNull(journals.deletedAt)))
    .get();
  return row ? toJournalView(row, tagNamesFor(db, row.id)) : null;
}

/** Template returned for a day with no entry yet. Not persisted until the first save. */
export function templateFor(date: string): JournalView {
  const stamp = new Date(0).toISOString();
  return {
    id: "",
    date,
    type: "daily",
    mood: null,
    energyLevel: null,
    contentJson: EMPTY_DOC,
    contentPlain: "",
    whatHappened: null,
    accomplished: null,
    wentWell: null,
    didNotGoWell: null,
    learned: null,
    improveTomorrow: null,
    gratitude: null,
    notes: null,
    private: false,
    status: "draft",
    tags: [],
    updatedAt: stamp,
  };
}

function replaceTags(db: DbExec, journalId: string, names: readonly string[], ctx: ServiceContext): void {
  db.delete(journalTags).where(eq(journalTags.journalId, journalId)).run();
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
    db.insert(journalTags).values({ journalId, tagId: tag.id }).onConflictDoNothing().run();
  }
}

/**
 * Upserts the daily entry for a date. Autosave-safe: the same date always maps
 * to the same row, so repeated saves never create duplicates (SDD §10 §4).
 */
export function saveDailyEntry(db: Db, input: JournalUpsertInput, partial?: Partial<ServiceContext>): JournalView {
  const ctx = ctxOf(partial);
  const plain = extractPlainText(input.contentJson);
  const now = ctx.now();

  let id = "";
  db.transaction((tx) => {
    const existing = aliveDailyRow(tx, input.date);
    const values = {
      type: input.type,
      mood: input.mood,
      energyLevel: input.energyLevel,
      contentJson: input.contentJson,
      contentPlain: plain,
      whatHappened: input.whatHappened,
      accomplished: input.accomplished,
      wentWell: input.wentWell,
      didNotGoWell: input.didNotGoWell,
      learned: input.learned,
      improveTomorrow: input.improveTomorrow,
      gratitude: input.gratitude,
      notes: input.notes,
      private: input.private,
      status: input.status,
      updatedAt: now,
    };
    if (existing) {
      tx.update(journals).set(values).where(eq(journals.id, existing.id)).run();
      id = existing.id;
    } else {
      id = ctx.newId();
      tx.insert(journals)
        .values({ id, date: input.date, createdAt: now, ...values })
        .run();
    }
    replaceTags(tx, id, input.tags, ctx);
    if (input.attachmentIds.length > 0) {
      bindAttachments(tx, input.attachmentIds, "journal", id);
    }
  });

  const row = db.select().from(journals).where(eq(journals.id, id)).get();
  if (!row) {
    throw new AppError("DB", "Could not save the journal entry.");
  }
  return toJournalView(row, tagNamesFor(db, id));
}

export function finalizeDailyEntry(db: Db, id: string, partial?: Partial<ServiceContext>): JournalView {
  const ctx = ctxOf(partial);
  const row = db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), isNull(journals.deletedAt)))
    .get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Journal entry not found.");
  }
  db.update(journals).set({ status: "final", updatedAt: ctx.now() }).where(eq(journals.id, id)).run();
  const updated = db.select().from(journals).where(eq(journals.id, id)).get();
  if (!updated) {
    throw new AppError("DB", "Could not finalize the journal entry.");
  }
  return toJournalView(updated, tagNamesFor(db, id));
}

export function deleteEntry(db: Db, id: string, partial?: Partial<ServiceContext>): void {
  const ctx = ctxOf(partial);
  const row = db
    .select({ id: journals.id })
    .from(journals)
    .where(and(eq(journals.id, id), isNull(journals.deletedAt)))
    .get();
  if (!row) {
    throw new AppError("NOT_FOUND", "Journal entry not found.");
  }
  const now = ctx.now();
  db.update(journals).set({ deletedAt: now, updatedAt: now }).where(eq(journals.id, id)).run();
}

/** Summaries for a calendar month (YYYY-MM), newest first. */
export function listMonth(db: DbExec, month: string): JournalSummary[] {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: { month: ["Use the format YYYY-MM."] },
    });
  }
  const from = `${month}-01`;
  const to = `${month}-31`;
  return db
    .select({
      id: journals.id,
      date: journals.date,
      mood: journals.mood,
      contentPlain: journals.contentPlain,
      status: journals.status,
      updatedAt: journals.updatedAt,
    })
    .from(journals)
    .where(
      and(
        eq(journals.type, "daily"),
        isNull(journals.deletedAt),
        gte(journals.date, from),
        lte(journals.date, to),
      ),
    )
    .orderBy(desc(journals.date))
    .all()
    .map((row) => ({
      id: row.id,
      date: row.date,
      mood: row.mood,
      preview: row.contentPlain.slice(0, 160),
      status: row.status as JournalSummary["status"],
      updatedAt: row.updatedAt,
    }));
}
