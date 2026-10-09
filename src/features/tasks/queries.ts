import { getDb } from "@/db/runtime";
import { localIsoDay } from "@/lib/domain/dates";
import { AppError } from "@/lib/errors";
import { getTask, listTaskLanes, type TaskView } from "./service";
import type { Lane } from "@/lib/domain/task-lanes";

export function loadTaskLanes(): { lanes: Record<Lane, TaskView[]>; today: string } {
  const today = localIsoDay();
  return { lanes: listTaskLanes(getDb(), today), today };
}

export function loadTask(id: string): TaskView | null {
  try {
    return getTask(getDb(), id, localIsoDay());
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}
