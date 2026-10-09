"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { habitArchiveSchema, habitIdSchema, habitInputSchema, habitLogToggleSchema, habitUpdateSchema } from "@/schemas/habit";
import type { ActionResult } from "@/types/result";
import { createHabit, deleteHabit, setHabitArchived, toggleHabitLog, updateHabit, type HabitView } from "./service";

function revalidateHabits(id?: string): void {
  revalidatePath("/habits");
  revalidatePath("/today");
  revalidatePath("/");
  if (id) {
    revalidatePath(`/habits/${id}`);
  }
}

const createHandler = defineAction("habit.create", habitInputSchema, (input): HabitView => {
  const view = createHabit(getDb(), input);
  revalidateHabits(view.id);
  return view;
});

const updateHandler = defineAction("habit.update", habitUpdateSchema, ({ id, patch }): HabitView => {
  const view = updateHabit(getDb(), id, patch);
  revalidateHabits(id);
  return view;
});

const archiveHandler = defineAction("habit.archive", habitArchiveSchema, ({ id, archived }): HabitView => {
  const view = setHabitArchived(getDb(), id, archived);
  revalidateHabits(id);
  return view;
});

const deleteHandler = defineAction("habit.delete", habitIdSchema, ({ id }): { id: string } => {
  deleteHabit(getDb(), id);
  revalidateHabits(id);
  return { id };
});

const toggleHandler = defineAction(
  "habit.toggle",
  habitLogToggleSchema,
  (input): { habit: HabitView; done: boolean } => {
    const result = toggleHabitLog(getDb(), input);
    revalidateHabits(input.habitId);
    return result;
  },
);

export async function createHabitAction(raw: unknown): Promise<ActionResult<HabitView>> {
  return createHandler(raw);
}

export async function updateHabitAction(raw: unknown): Promise<ActionResult<HabitView>> {
  return updateHandler(raw);
}

export async function setHabitArchivedAction(raw: unknown): Promise<ActionResult<HabitView>> {
  return archiveHandler(raw);
}

export async function deleteHabitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return deleteHandler(raw);
}

export async function toggleHabitLogAction(raw: unknown): Promise<ActionResult<{ habit: HabitView; done: boolean }>> {
  return toggleHandler(raw);
}
