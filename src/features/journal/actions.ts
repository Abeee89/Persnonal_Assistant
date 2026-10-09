"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { isoDay } from "@/schemas/common";
import { journalUpsertSchema } from "@/schemas/journal";
import type { ActionResult } from "@/types/result";
import { deleteEntry, finalizeDailyEntry, saveDailyEntry, type JournalView } from "./service";

function revalidateJournal(date?: string): void {
  revalidatePath("/journal");
  revalidatePath("/");
  if (date) {
    revalidatePath(`/journal/${date}`);
  }
}

const saveHandler = defineAction("journal.save", journalUpsertSchema, (input): JournalView => {
  const view = saveDailyEntry(getDb(), input);
  revalidateJournal(input.date);
  return view;
});

const finalizeHandler = defineAction("journal.finalize", z.object({ id: z.string().min(1).max(64) }), ({ id }): JournalView => {
  const view = finalizeDailyEntry(getDb(), id);
  revalidateJournal(view.date);
  return view;
});

const deleteHandler = defineAction(
  "journal.delete",
  z.object({ id: z.string().min(1).max(64), date: isoDay }),
  ({ id, date }): { id: string } => {
    deleteEntry(getDb(), id);
    revalidateJournal(date);
    return { id };
  },
);

export async function saveJournalAction(raw: unknown): Promise<ActionResult<JournalView>> {
  return saveHandler(raw);
}

export async function finalizeJournalAction(raw: unknown): Promise<ActionResult<JournalView>> {
  return finalizeHandler(raw);
}

export async function deleteJournalAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}
