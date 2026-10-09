import { z } from "zod";
import { ATTACHMENT_ENTITY_TYPES } from "@/config/enums";
import { entityId } from "./common";

export const ATTACHMENT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIME)[number];

export const attachmentUploadMetaSchema = z.object({
  entityType: z.enum(ATTACHMENT_ENTITY_TYPES),
  entityId: entityId.nullable().optional().transform((value) => value ?? null),
});

export const attachmentBindSchema = z.object({
  attachmentIds: z.array(entityId).min(1).max(20),
  entityType: z.enum(ATTACHMENT_ENTITY_TYPES),
  entityId: entityId,
});

export const attachmentIdSchema = z.object({ id: entityId });
