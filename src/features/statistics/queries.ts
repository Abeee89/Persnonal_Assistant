import { getDb } from "@/db/runtime";
import type { StatsPeriod } from "@/config/enums";
import { localIsoDay } from "@/lib/domain/dates";
import { windowFor, type PeriodWindow } from "@/lib/domain/stats-window";
import { loadPreferences } from "@/features/preferences/queries";
import { buildStats, type StatsSnapshot } from "./service";

export function loadStats(period: StatsPeriod, anchor: string): StatsSnapshot {
  const weekStart = loadPreferences().weekStart;
  return buildStats(getDb(), windowFor(period, anchor, weekStart));
}

export function currentWindow(period: StatsPeriod, anchor: string): PeriodWindow {
  return windowFor(period, anchor, loadPreferences().weekStart);
}

export function today(): string {
  return localIsoDay();
}
