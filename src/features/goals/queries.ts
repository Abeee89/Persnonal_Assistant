import { getDb } from "@/db/runtime";
import { AppError } from "@/lib/errors";
import { getGoal, listGoals, type GoalSummary, type GoalView } from "./service";

export function loadGoals(includeArchived: boolean): GoalSummary[] {
  return listGoals(getDb(), includeArchived);
}

export function loadGoal(id: string): GoalView | null {
  try {
    return getGoal(getDb(), id);
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}
