"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TASK_STATUSES } from "@/config/enums";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { taskIdSchema, taskInputSchema, taskUpdateSchema } from "@/schemas/task";
import type { ActionResult } from "@/types/result";
import { createTask, deleteTask, setTaskStatus, updateTask, type TaskView } from "./service";

function revalidateTasks(id?: string, goalId?: string | null): void {
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/today");
  if (id) {
    revalidatePath(`/tasks/${id}`);
  }
  if (goalId) {
    revalidatePath(`/goals/${goalId}`);
  }
}

const createHandler = defineAction("task.create", taskInputSchema, (input): TaskView => {
  const view = createTask(getDb(), input);
  revalidateTasks(view.id, view.goalId);
  return view;
});

const updateHandler = defineAction("task.update", taskUpdateSchema, ({ id, patch }): TaskView => {
  const view = updateTask(getDb(), id, patch);
  revalidateTasks(id, view.goalId);
  return view;
});

const statusHandler = defineAction(
  "task.setStatus",
  z.object({ id: taskIdSchema.shape.id, status: z.enum(TASK_STATUSES) }),
  ({ id, status }): TaskView => {
    const view = setTaskStatus(getDb(), id, status);
    revalidateTasks(id, view.goalId);
    return view;
  },
);

const deleteHandler = defineAction("task.delete", taskIdSchema, ({ id }): { id: string } => {
  deleteTask(getDb(), id);
  revalidateTasks(id);
  return { id };
});

export async function createTaskAction(raw: unknown): Promise<ActionResult<TaskView>> {
  return createHandler(raw);
}

export async function updateTaskAction(raw: unknown): Promise<ActionResult<TaskView>> {
  return updateHandler(raw);
}

export async function setTaskStatusAction(raw: unknown): Promise<ActionResult<TaskView>> {
  return statusHandler(raw);
}

export async function deleteTaskAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}
