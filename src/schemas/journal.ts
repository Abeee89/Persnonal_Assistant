import { z } from "zod";
import { JOURNAL_STATUSES, JOURNAL_TYPES } from "@/config/enums";
import { entityId, isoDay, multiline, optionalScale15, tagList } from "./common";

/** Max serialized TipTap document size (SDD §05 §6: 1 MB). */
export const MAX_JOURNAL_DOC_BYTES = 1024 * 1024;

export const tiptapDocSchema = z
  .string()
  .max(MAX_JOURNAL_DOC_BYTES, "Journal entry is too large.")
  .refine((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Journal content must be a valid document.");

export const journalUpsertSchema = z.object({
  date: isoDay,
  type: z.enum(JOURNAL_TYPES).default("daily"),
  mood: optionalScale15,
  energyLevel: optionalScale15,
  contentJson: tiptapDocSchema.default("{}"),
  whatHappened: multiline(5000, "This section"),
  accomplished: multiline(5000, "This section"),
  wentWell: multiline(5000, "This section"),
  didNotGoWell: multiline(5000, "This section"),
  learned: multiline(5000, "This section"),
  improveTomorrow: multiline(5000, "This section"),
  gratitude: multiline(2000, "This section"),
  notes: multiline(10000, "Notes"),
  private: z.boolean().default(false),
  status: z.enum(JOURNAL_STATUSES).default("draft"),
  tags: tagList.default([]),
  attachmentIds: z.array(entityId).max(20).default([]),
});

export type JournalUpsertInput = z.infer<typeof journalUpsertSchema>;
