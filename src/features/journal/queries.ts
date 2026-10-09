import { getDb } from "@/db/runtime";
import { listForEntity } from "@/features/attachments/service";
import type { AttachmentView } from "@/features/attachments/service";
import { getDailyEntry, listMonth, templateFor, type JournalSummary, type JournalView } from "./service";

export function loadDay(date: string): {
  entry: JournalView | null;
  template: JournalView;
  attachments: AttachmentView[];
} {
  const db = getDb();
  const entry = getDailyEntry(db, date);
  return {
    entry,
    template: templateFor(date),
    attachments: entry ? listForEntity(db, "journal", entry.id) : [],
  };
}

export function loadMonth(month: string): JournalSummary[] {
  return listMonth(getDb(), month);
}
