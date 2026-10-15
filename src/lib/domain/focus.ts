export type FocusCard = "overdue" | "reflection" | "goal" | "none";

export interface FocusInput {
  overdueCount: number;
  hasTodayJournal: boolean;
  hasActiveGoal: boolean;
}

/**
 * Chooses the single rotating card on the dashboard (SDD §07). Priority: things
 * slipping, then the daily reflection, then goals, otherwise nothing to push.
 */
export function pickFocusCard(input: FocusInput): FocusCard {
  if (input.overdueCount > 0) {
    return "overdue";
  }
  if (!input.hasTodayJournal) {
    return "reflection";
  }
  if (input.hasActiveGoal) {
    return "goal";
  }
  return "none";
}

export function greetingFor(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}
