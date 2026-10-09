import { getDb } from "@/db/runtime";
import { listForEntity, type AttachmentView } from "./service";
import type { AttachmentEntityType } from "./types";

export function loadAttachments(entityType: AttachmentEntityType, entityId: string): AttachmentView[] {
  return listForEntity(getDb(), entityType, entityId);
}
