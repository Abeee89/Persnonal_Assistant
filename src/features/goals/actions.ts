"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { goalIdSchema, goalInputSchema, goalUpdateSchema, milestoneIdSchema, milestoneInputSchema, milestoneToggleSchema } from "@/schemas/goal";
import type { ActionResult } from "@/types/result";
import { addMilestone, createGoal, deleteMilestone, softDeleteGoal, toggleMilestone, updateGoal, type GoalView } from "./service";

function revalidateGoals(id?: string): void {
  revalidatePath("/goals");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (id) {
    revalidatePath(`/goals/${id}`);
  }
}

const createHandler = defineAction("goal.create", goalInputSchema, (input): GoalView => {
  const view = createGoal(getDb(), input);
  revalidateGoals(view.id);
  return view;
});

const updateHandler = defineAction("goal.update", goalUpdateSchema, ({ id, patch }): GoalView => {
  const view = updateGoal(getDb(), id, patch);
  revalidateGoals(id);
  return view;
});

const deleteHandler = defineAction("goal.delete", goalIdSchema, ({ id }): { id: string } => {
  softDeleteGoal(getDb(), id);
  revalidateGoals(id);
  return { id };
});

const addMilestoneHandler = defineAction("milestone.add", milestoneInputSchema, (input): GoalView => {
  const view = addMilestone(getDb(), input);
  revalidateGoals(view.id);
  return view;
});

const toggleMilestoneHandler = defineAction("milestone.toggle", milestoneToggleSchema, ({ id, done }): GoalView => {
  const view = toggleMilestone(getDb(), id, done);
  revalidateGoals(view.id);
  return view;
});

const deleteMilestoneHandler = defineAction("milestone.delete", milestoneIdSchema, ({ id }): GoalView => {
  const view = deleteMilestone(getDb(), id);
  revalidateGoals(view.id);
  return view;
});

export async function createGoalAction(raw: unknown): Promise<ActionResult<GoalView>> {
  return createHandler(raw);
}

export async function updateGoalAction(raw: unknown): Promise<ActionResult<GoalView>> {
  return updateHandler(raw);
}

export async function deleteGoalAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}

export async function addMilestoneAction(raw: unknown): Promise<ActionResult<GoalView>> {
  return addMilestoneHandler(raw);
}

export async function toggleMilestoneAction(raw: unknown): Promise<ActionResult<GoalView>> {
  return toggleMilestoneHandler(raw);
}

export async function deleteMilestoneAction(raw: unknown): Promise<ActionResult<GoalView>> {
  return deleteMilestoneHandler(raw);
}
