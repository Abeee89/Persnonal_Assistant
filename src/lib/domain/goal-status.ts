export type GoalStatus = "not_started" | "in_progress" | "completed" | "archived";

export interface GoalStatusInput {
  status: GoalStatus;
  progressMode: "auto" | "manual";
  progress: number;
}

/**
 * Auto status transitions for auto-progress goals (SDD §10 §2, §11):
 * - progress reaches 100 → completed
 * - progress drops below 100 after completion → in_progress
 * - first completed milestone moves not_started → in_progress
 * Archived goals and manual-progress goals keep the status the user chose.
 */
export function reconcileGoalStatus(input: GoalStatusInput): GoalStatus {
  if (input.status === "archived" || input.progressMode === "manual") {
    return input.status;
  }
  if (input.progress >= 100) {
    return "completed";
  }
  if (input.status === "completed") {
    return "in_progress";
  }
  if (input.progress > 0 && input.status === "not_started") {
    return "in_progress";
  }
  return input.status;
}
