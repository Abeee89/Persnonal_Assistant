import { STATS_PERIODS, type StatsPeriod } from "@/config/enums";
import { isIsoDay } from "@/lib/domain/dates";

export interface StatsState {
  period: StatsPeriod;
  anchor: string;
}

type Raw = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseStatsState(raw: Raw, today: string): StatsState {
  const periodValue = first(raw.period);
  const period = (STATS_PERIODS as readonly string[]).includes(periodValue ?? "")
    ? (periodValue as StatsPeriod)
    : "week";
  const dateValue = first(raw.date);
  const anchor = dateValue && isIsoDay(dateValue) ? dateValue : today;
  return { period, anchor };
}

export function statsHref(state: Partial<StatsState>): string {
  const params = new URLSearchParams();
  if (state.period) {
    params.set("period", state.period);
  }
  if (state.anchor) {
    params.set("date", state.anchor);
  }
  const query = params.toString();
  return query ? `/statistics?${query}` : "/statistics";
}
