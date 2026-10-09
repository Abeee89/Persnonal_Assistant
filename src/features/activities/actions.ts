"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACTIVITY_STATUSES } from "@/config/enums";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import type { ActionResult } from "@/types/result";
import { isoDay } from "@/schemas/common";
import { activityIdSchema, activityInputSchema, activityUpdateSchema } from "@/schemas/activity";
import {
  createActivity,
  deleteActivity,
  duplicateActivity,
  restoreActivity,
  setActivityStatus,
  updateActivity,
  type ActivityView,
} from "./service";

const ACTIVITY_PATHS = ["/", "/today", "/calendar", "/activities"] as const;

function revalidateActivityViews(id?: string): void {
  for (const path of ACTIVITY_PATHS) {
    revalidatePath(path);
  }
  if (id) {
    revalidatePath(`/activities/${id}`);
  }
}

const createHandler = defineAction("activity.create", activityInputSchema, (input): ActivityView => {
  const view = createActivity(getDb(), input);
  revalidateActivityViews(view.id);
  return view;
});

const updateHandler = defineAction("activity.update", activityUpdateSchema, ({ id, patch }): ActivityView => {
  const view = updateActivity(getDb(), id, patch);
  revalidateActivityViews(id);
  return view;
});

const setStatusHandler = defineAction(
  "activity.setStatus",
  z.object({ id: activityIdSchema.shape.id, status: z.enum(ACTIVITY_STATUSES) }),
  ({ id, status }): ActivityView => {
    const view = setActivityStatus(getDb(), id, status);
    revalidateActivityViews(id);
    return view;
  },
);

const duplicateHandler = defineAction(
  "activity.duplicate",
  z.object({ id: activityIdSchema.shape.id, date: isoDay }),
  ({ id, date }): ActivityView => {
    const view = duplicateActivity(getDb(), id, date);
    revalidateActivityViews(view.id);
    return view;
  },
);

const deleteHandler = defineAction("activity.delete", activityIdSchema, ({ id }): { id: string } => {
  deleteActivity(getDb(), id);
  revalidateActivityViews(id);
  return { id };
});

const restoreHandler = defineAction("activity.restore", activityIdSchema, ({ id }): ActivityView => {
  const view = restoreActivity(getDb(), id);
  revalidateActivityViews(id);
  return view;
});

export async function createActivityAction(raw: unknown): Promise<ActionResult<ActivityView>> {
  return createHandler(raw);
}

export async function updateActivityAction(raw: unknown): Promise<ActionResult<ActivityView>> {
  return updateHandler(raw);
}

export async function setActivityStatusAction(raw: unknown): Promise<ActionResult<ActivityView>> {
  return setStatusHandler(raw);
}

export async function duplicateActivityAction(raw: unknown): Promise<ActionResult<ActivityView>> {
  return duplicateHandler(raw);
}

export async function deleteActivityAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}

export async function restoreActivityAction(raw: unknown): Promise<ActionResult<ActivityView>> {
  return restoreHandler(raw);
}
