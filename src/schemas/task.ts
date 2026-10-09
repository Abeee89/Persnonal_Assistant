import { z } from "zod";
import { PRIORITIES, TASK_STATUSES } from "@/config/enums";
import { entityId, line, multiline, optionalIsoDay, tagList } from "./common";

const optionalRef = z
  .string()
  .min(1)
  .max(64)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const taskBaseSchema = z.object({
  title: line(200, "Title"),
  description: multiline(5000, "Description"),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(PRIORITIES).default("medium"),
  dueDate: optionalIsoDay,
  categoryId: optionalRef,
  goalId: optionalRef,
  activityId: optionalRef,
  tags: tagList.default([]),
});

export const taskInputSchema = taskBaseSchema;

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskUpdateSchema = z.object({
  id: entityId,
  patch: taskBaseSchema.partial(),
});

export const taskStatusSchema = z.object({
  id: entityId,
  status: z.enum(TASK_STATUSES),
});

export type TaskStatusInput = z.infer<typeof taskStatusSchema>;

export const taskIdSchema = z.object({ id: entityId });
