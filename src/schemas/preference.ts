import { z } from "zod";
import { line } from "./common";

/**
 * Whitelisted preference keys (SDD §06 §3). Unknown keys are rejected so arbitrary
 * data cannot be written into the preferences table.
 *
 * Theme is deliberately not stored here: the browser already persists it (see
 * lib/theme.ts), so keeping a second copy would create two sources of truth.
 */
export const preferenceValueSchemas = {
  displayName: line(60, "Display name"),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  density: z.enum(["comfortable", "compact"]),
  shortcutsEnabled: z.boolean(),
  attachmentMaxBytes: z.number().int().min(1024).max(50 * 1024 * 1024),
} as const;

export type PreferenceKey = keyof typeof preferenceValueSchemas;

export const PREFERENCE_KEYS = Object.keys(preferenceValueSchemas) as PreferenceKey[];

export function preferenceSchemaFor(key: string) {
  if (!(PREFERENCE_KEYS as string[]).includes(key)) {
    return null;
  }
  return preferenceValueSchemas[key as PreferenceKey];
}

export const preferenceSetSchema = z
  .object({
    key: z.string(),
    value: z.unknown(),
  })
  .superRefine((input, ctx) => {
    const valueSchema = preferenceSchemaFor(input.key);
    if (!valueSchema) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "Unknown preference." });
      return;
    }
    const result = valueSchema.safeParse(input.value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: "custom", path: ["value", ...issue.path], message: issue.message });
      }
    }
  });
