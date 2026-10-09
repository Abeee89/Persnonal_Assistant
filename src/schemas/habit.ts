import { z } from "zod";
import { HABIT_FREQUENCIES } from "@/config/enums";
import { entityId, isoDay, line, multiline } from "./common";

export const habitInputSchema = z
  .object({
    name: line(80, "Name"),
    description: multiline(500, "Description"),
    frequency: z.enum(HABIT_FREQUENCIES).default("daily"),
    intervalCount: z.number().int().min(1).max(12).default(1),
    targetPerPeriod: z
      .union([z.number().int().min(1).max(31), z.null()])
      .optional()
      .transform((value) => value ?? null),
    color: z
      .union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4C6EF5."), z.null()])
      .optional()
      .transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "daily" && value.targetPerPeriod !== null && value.targetPerPeriod !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["targetPerPeriod"],
        message: "Daily habits have a target of one per day.",
      });
    }
    if (value.frequency === "weekly" && value.targetPerPeriod !== null && value.targetPerPeriod > 7) {
      ctx.addIssue({ code: "custom", path: ["targetPerPeriod"], message: "A weekly target can be at most 7." });
    }
  });

export type HabitInput = z.infer<typeof habitInputSchema>;

export const habitLogToggleSchema = z.object({
  habitId: entityId,
  date: isoDay,
  /** Expected state from the client. Mismatch returns the server truth (SDD §07 §3). */
  expectedDone: z.boolean().optional(),
});

export type HabitLogToggleInput = z.infer<typeof habitLogToggleSchema>;
