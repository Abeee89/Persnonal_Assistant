export interface MilestoneLike {
  done: boolean;
}

export interface GoalProgressInput {
  progressMode: "auto" | "manual";
  manualProgress: number | null;
  milestones: readonly MilestoneLike[];
}

/**
 * SDD §10 §11 strategy:
 * - auto: completed milestones / total milestones, rounded; 0 when none exist
 * - manual: the user-set value, clamped to 0..100; 0 when unset
 */
export function calculateGoalProgress(input: GoalProgressInput): number {
  if (input.progressMode === "manual") {
    const value = input.manualProgress ?? 0;
    return clamp(Math.round(value), 0, 100);
  }
  const total = input.milestones.length;
  if (total === 0) {
    return 0;
  }
  const done = input.milestones.filter((milestone) => milestone.done).length;
  return Math.round((done / total) * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
