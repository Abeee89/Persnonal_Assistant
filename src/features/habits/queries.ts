import { getDb } from "@/db/runtime";
import { AppError } from "@/lib/errors";
import { localIsoDay } from "@/lib/domain/dates";
import { getHabit, heatmapFor, listHabits, type HabitView } from "./service";

export function loadHabits(includeArchived: boolean): { habits: HabitView[]; today: string } {
  const today = localIsoDay();
  return { habits: listHabits(getDb(), today, includeArchived), today };
}

export function loadHabit(id: string): { habit: HabitView; heatmap: { day: string; done: boolean }[] } | null {
  const db = getDb();
  const today = localIsoDay();
  try {
    return { habit: getHabit(db, id, today), heatmap: heatmapFor(db, id, today) };
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}
