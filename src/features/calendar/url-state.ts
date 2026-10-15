import { CALENDAR_VIEWS, EVENT_KINDS, type CalendarView, type EventKind } from "@/config/enums";
import { isIsoDay } from "@/lib/domain/dates";
import { normaliseKinds } from "./service";

export interface CalendarState {
  view: CalendarView;
  anchor: string;
  kinds: EventKind[];
}

type Raw = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses `?view=&date=&types=` from the URL. Anything invalid falls back to a safe
 * default rather than erroring, so a stale or hand-edited link still renders.
 */
export function parseCalendarState(raw: Raw, today: string): CalendarState {
  const viewValue = first(raw.view);
  const view = (CALENDAR_VIEWS as readonly string[]).includes(viewValue ?? "")
    ? (viewValue as CalendarView)
    : "month";
  const dateValue = first(raw.date);
  const anchor = dateValue && isIsoDay(dateValue) ? dateValue : today;
  const typesValue = first(raw.types);
  const requested = typesValue ? typesValue.split(",") : undefined;
  const kinds = normaliseKinds(requested).filter((kind): kind is EventKind => (EVENT_KINDS as readonly string[]).includes(kind));
  return { view, anchor, kinds };
}

export function calendarHref(state: Partial<CalendarState>): string {
  const params = new URLSearchParams();
  if (state.view) {
    params.set("view", state.view);
  }
  if (state.anchor) {
    params.set("date", state.anchor);
  }
  if (state.kinds && state.kinds.length < EVENT_KINDS.length) {
    params.set("types", state.kinds.join(","));
  }
  const query = params.toString();
  return query ? `/calendar?${query}` : "/calendar";
}
