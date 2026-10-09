import { z } from "zod";
import { ACTIVITY_STATUSES, PRIORITIES } from "@/config/enums";
import { calculateDuration } from "@/lib/domain/duration";
import {
  entityId,
  isoDay,
  line,
  multiline,
  optionalIsoDay,
  optionalLine,
  optionalScale15,
  optionalTimeOfDay,
  tagList,
} from "./common";

const activityBase = z.object({
  title: line(200, "Title"),
  description: multiline(5000, "Description"),
  categoryId: z.string().min(1).max(64).nullable().optional().transform((value) => value ?? null),
  goalId: z.string().min(1).max(64).nullable().optional().transform((value) => value ?? null),
  date: isoDay,
  startTime: optionalTimeOfDay,
  endTime: optionalTimeOfDay,
  allDay: z.boolean().default(false),
  status: z.enum(ACTIVITY_STATUSES).default("planned"),
  priority: z.enum(PRIORITIES).default("medium"),
  location: optionalLine(120, "Location"),
  mood: optionalScale15,
  energyLevel: optionalScale15,
  tags: tagList.default([]),
});

export const activityInputSchema = activityBase.superRefine((value, ctx) => {
  if (value.allDay) {
    return;
  }
  if (value.startTime !== null && value.endTime !== null) {
    if (calculateDuration(value.startTime, value.endTime) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time.",
      });
    }
  }
  if (value.endTime !== null && value.startTime === null) {
    ctx.addIssue({
      code: "custom",
      path: ["startTime"],
      message: "Add a start time when you set an end time.",
    });
  }
});

export type ActivityInput = z.infer<typeof activityInputSchema>;

export const activityUpdateSchema = z.object({
  id: entityId,
  patch: activityBase.partial(),
});

export const activityIdSchema = z.object({ id: entityId });

export const activityListQuerySchema = z.object({
  from: optionalIsoDay,
  to: optionalIsoDay,
  categoryId: z.string().min(1).max(64).nullable().optional().transform((value) => value ?? null),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional().transform((value) => value ?? null),
  priority: z.enum(PRIORITIES).nullable().optional().transform((value) => value ?? null),
  q: optionalLine(200, "Search"),
  sort: z.enum(["date_asc", "date_desc", "duration_desc"]).default("date_desc"),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).nullable().optional().transform((value) => value ?? null),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
