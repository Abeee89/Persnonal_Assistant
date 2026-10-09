import { z } from "zod";
import { GOAL_STATUSES, PRIORITIES, PROGRESS_MODES } from "@/config/enums";
import { entityId, line, multiline, optionalIsoDay, tagList } from "./common";

const optionalRef = z
  .string()
  .min(1)
  .max(64)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const goalBaseSchema = z.object({
  title: line(200, "Title"),
  description: multiline(5000, "Description"),
  categoryId: optionalRef,
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.enum(GOAL_STATUSES).default("not_started"),
  progressMode: z.enum(PROGRESS_MODES).default("auto"),
  manualProgress: z
    .union([z.number().int().min(0).max(100), z.null()])
    .optional()
    .transform((value) => value ?? null),
  startDate: optionalIsoDay,
  deadline: optionalIsoDay,
  tags: tagList.default([]),
});

export const goalInputSchema = goalBaseSchema.superRefine((value, ctx) => {
  if (value.startDate !== null && value.deadline !== null && value.deadline < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be on or after the start date." });
  }
  if (value.progressMode === "manual" && value.manualProgress === null) {
    ctx.addIssue({ code: "custom", path: ["manualProgress"], message: "Set a progress value for manual mode." });
  }
});

export type GoalInput = z.infer<typeof goalInputSchema>;

export const goalUpdateSchema = z.object({
  id: entityId,
  patch: goalBaseSchema.partial(),
});

export const goalIdSchema = z.object({ id: entityId });

export const milestoneInputSchema = z.object({
  goalId: entityId,
  title: line(200, "Milestone"),
  dueDate: optionalIsoDay,
});

export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

export const milestoneToggleSchema = z.object({
  id: entityId,
  done: z.boolean(),
});

export const milestoneIdSchema = z.object({ id: entityId });
