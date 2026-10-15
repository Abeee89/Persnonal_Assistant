import { getDb } from "@/db/runtime";
import { visibleDays, shiftAnchor } from "@/lib/domain/calendar";
import { listEvents, type CalendarEvent } from "./service";
import type { CalendarState } from "./url-state";

export interface CalendarData {
  days: string[];
  events: CalendarEvent[];
  eventsByDay: Record<string, CalendarEvent[]>;
  prev: string;
  next: string;
}

export function loadCalendar(state: CalendarState, weekStart: 0 | 1 = 1): CalendarData {
  const days = visibleDays(state.view, state.anchor, weekStart);
  const from = days[0] ?? state.anchor;
  const to = days[days.length - 1] ?? state.anchor;
  const events = listEvents(getDb(), { from, to, kinds: state.kinds });
  const eventsByDay: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    (eventsByDay[event.day] ??= []).push(event);
  }
  return {
    days,
    events,
    eventsByDay,
    prev: shiftAnchor(state.view, state.anchor, -1),
    next: shiftAnchor(state.view, state.anchor, 1),
  };
}
