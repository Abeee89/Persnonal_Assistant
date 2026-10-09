import { z } from "zod";
import { HABIT_FREQUENCIES } from "@/config/enums";
import { entityId, isoDay, line, multiline } from "./common";

const hexColor = z
  .union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4C6EF5."), z.null()])
  .optional()
  .transform((value) => value ?? null);

export const habitBaseSchema = z.object({
  name: line(80, "Name"),
  description: multiline(500, "Description"),
  frequency: z.enum(HABIT_FREQUENCIES).default("daily"),
  intervalCount: z.number().int().min(1).max(12).default(1),
  targetPerPeriod: z
    .union([z.number().int().min(1).max(31), z.null()])
    .optional()
    .transform((value) => value ?? null),
  color: hexColor,
});

export function checkHabitRules(value: {
  frequency: string;
  targetPerPeriod: number | null;
}): { path: "targetPerPeriod"; message: string } | null {
  if (value.frequency === "daily" && value.targetPerPeriod !== null && value.targetPerPeriod !== 1) {
    return { path: "targetPerPeriod", message: "Daily habits have a target of one per day." };
  }
  if (value.frequency === "weekly" && value.targetPerPeriod !== null && value.targetPerPeriod > 7) {
    return { path: "targetPerPeriod", message: "A weekly target can be at most 7." };
  }
  if (value.frequency === "monthly" && value.targetPerPeriod !== null && value.targetPerPeriod > 31) {
    return { path: "targetPerPeriod", message: "A monthly target can be at most 31." };
  }
  return null;
}

export const habitInputSchema = habitBaseSchema.superRefine((value, ctx) => {
  const rule = checkHabitRules(value);
  if (rule) {
    ctx.addIssue({ code: "custom", path: [rule.path], message: rule.message });
  }
});

export type HabitInput = z.infer<typeof habitInputSchema>;

export const habitUpdateSchema = z.object({
  id: entityId,
  patch: habitBaseSchema.partial(),
});

export const habitIdSchema = z.object({ id: entityId });

export const habitArchiveSchema = z.object({
  id: entityId,
  archived: z.boolean(),
});

export const habitLogToggleSchema = z.object({
  habitId: entityId,
  date: isoDay,
  /** Expected state from the client. Mismatch returns the server truth (SDD §07 §3). */
  expectedDone: z.boolean().optional(),
});

export type HabitLogToggleInput = z.infer<typeof habitLogToggleSchema>;
