import { getDb } from "@/db/runtime";
import { localIsoDay } from "@/lib/domain/dates";
import { buildDashboard, type DashboardSnapshot } from "./service";

export function loadDashboard(day: string = localIsoDay(), hour: number = new Date().getHours()): {
  snapshot: DashboardSnapshot;
  hour: number;
} {
  return { snapshot: buildDashboard(getDb(), day), hour };
}
