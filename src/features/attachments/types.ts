export const ATTACHMENT_ENTITY_TYPES = ["activity", "journal", "task", "goal"] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];
