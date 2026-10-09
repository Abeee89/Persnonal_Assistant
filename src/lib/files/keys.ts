import type { AttachmentExt } from "./magic";

const STORAGE_KEY_PATTERN = /^(activity|journal|task|goal)\/\d{4}\/\d{2}\/[0-9a-zA-Z-]{1,64}\.(jpg|png|webp|pdf)$/;

/**
 * Server-generated relative key: `{entityType}/{yyyy}/{mm}/{uuid}.{ext}`.
 * The user's filename never reaches the path (SDD §08 §2).
 */
export function buildStorageKey(
  entityType: string,
  id: string,
  ext: AttachmentExt,
  day: string,
): string {
  const year = day.slice(0, 4);
  const month = day.slice(5, 7);
  return `${entityType}/${year}/${month}/${id}.${ext}`;
}

export function isSafeStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key);
}
