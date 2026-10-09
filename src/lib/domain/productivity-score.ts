/**
 * SDD §06 §6 productivity score (0–100).
 * Weights: tasks done 35%, planned-activity adherence 25%,
 * habit consistency 25%, journal presence 15%.
 * Each component is a ratio in [0,1]; a component with no denominator is 0.
 */
export interface ProductivityInput {
  tasksDone: number;
  tasksDue: number;
  activitiesDone: number;
  activitiesPlanned: number;
  habitsHit: number;
  habitsExpected: number;
  journaledDays: number;
  windowDays: number;
}

export const SCORE_WEIGHTS = {
  tasks: 0.35,
  activities: 0.25,
  habits: 0.25,
  journal: 0.15,
} as const;

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, numerator / denominator));
}

export function calculateProductivityScore(input: ProductivityInput): number {
  const score =
    SCORE_WEIGHTS.tasks * ratio(input.tasksDone, input.tasksDue) +
    SCORE_WEIGHTS.activities * ratio(input.activitiesDone, input.activitiesPlanned) +
    SCORE_WEIGHTS.habits * ratio(input.habitsHit, input.habitsExpected) +
    SCORE_WEIGHTS.journal * ratio(input.journaledDays, input.windowDays);
  return Math.round(score * 100);
}
