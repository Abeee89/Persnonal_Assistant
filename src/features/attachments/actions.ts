"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { entityId } from "@/schemas/common";
import { attachmentBindSchema, attachmentIdSchema } from "@/schemas/attachment";
import type { ActionResult } from "@/types/result";
import { getStorage } from "./runtime";
import { bindAttachments, deleteAttachment, type AttachmentView } from "./service";

const ENTITY_PATHS: Record<string, (id: string) => string[]> = {
  activity: (id) => ["/activities", `/activities/${id}`, `/activities/${id}/edit`, "/"],
  journal: () => ["/journal"],
  task: () => ["/tasks"],
  goal: (id) => ["/goals", `/goals/${id}`],
};

function revalidateFor(entityType: string, entityId: string): void {
  for (const path of ENTITY_PATHS[entityType]?.(entityId) ?? []) {
    revalidatePath(path);
  }
}

const bindHandler = defineAction("attachment.bind", attachmentBindSchema, ({ attachmentIds, entityType, entityId: target }): AttachmentView[] => {
  const views = bindAttachments(getDb(), attachmentIds, entityType, target);
  revalidateFor(entityType, target);
  return views;
});

const deleteHandler = defineAction(
  "attachment.delete",
  attachmentIdSchema.extend({ entityType: z.enum(["activity", "journal", "task", "goal"]), entityId: entityId.nullable() }),
  async ({ id, entityType, entityId: target }): Promise<{ id: string }> => {
    await deleteAttachment(getDb(), id, getStorage());
    if (target) {
      revalidateFor(entityType, target);
    }
    return { id };
  },
);

export async function bindAttachmentsAction(raw: unknown): Promise<ActionResult<AttachmentView[]>> {
  return bindHandler(raw);
}

export async function deleteAttachmentAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}
