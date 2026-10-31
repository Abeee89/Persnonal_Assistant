import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatIsoDay, parseIsoDay } from "@/lib/domain/dates";
import { findGaps, formatClock, toInterval, type Interval } from "@/lib/domain/timeline";
import type { CalendarEvent } from "../service";
import { KIND_LABEL } from "./calendar-toolbar";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dayNumber(day: string): number {
  return parseIsoDay(day).getUTCDate();
}

function chipClass(event: CalendarEvent): string {
  if (event.kind === "task" && event.status === "done") {
    return "text-muted-foreground line-through";
  }
  if (event.kind === "goal") {
    return "text-danger";
  }
  return "text-foreground";
}

export function MonthGrid({
  days,
  anchorMonth,
  eventsByDay,
  today,
}: {
  days: string[];
  anchorMonth: string;
  eventsByDay: Record<string, CalendarEvent[]>;
  today: string;
}) {
  const weekdays = days.slice(0, 7).map((day) => WEEKDAY.format(parseIsoDay(day)));
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border text-xs text-muted-foreground">
        {weekdays.map((name) => (
          <div key={name} className="px-2 py-1.5">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = eventsByDay[day] ?? [];
          const inMonth = day.slice(0, 7) === anchorMonth;
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "min-h-24 border-b border-r border-border p-1.5 text-xs",
                !inMonth && "bg-muted/40 text-muted-foreground",
              )}
            >
              <Link
                href={`/calendar?view=day&date=${day}`}
                className={cn(
                  "mb-1 inline-flex size-6 items-center justify-center rounded-full tabular-nums hover:bg-accent",
                  isToday && "bg-primary text-primary-foreground hover:bg-primary",
                )}
                aria-label={`${String(dayNumber(day))}, ${day}${items.length > 0 ? ` · ${String(items.length)} items` : ""}`}
              >
                {dayNumber(day)}
              </Link>
              <ul className="space-y-0.5">
                {items.slice(0, 3).map((event) => (
                  <li key={`${event.kind}:${event.id}`} className="truncate">
                    <Link href={event.href} className={cn("block truncate hover:underline", chipClass(event))}>
                      <span className="mr-1 text-muted-foreground">{KIND_LABEL[event.kind].charAt(0)}</span>
                      {event.title}
                    </Link>
                  </li>
                ))}
                {items.length > 3 ? (
                  <li>
                    <Link href={`/calendar?view=day&date=${day}`} className="text-muted-foreground hover:underline">
                      +{String(items.length - 3)} more
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekList({
  days,
  eventsByDay,
  today,
}: {
  days: string[];
  eventsByDay: Record<string, CalendarEvent[]>;
  today: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const items = eventsByDay[day] ?? [];
        return (
          <section key={day} aria-label={formatIsoDay(parseIsoDay(day))} className="rounded-lg border border-border bg-surface p-3">
            <h3 className={cn("mb-2 text-xs", day === today ? "font-semibold text-primary" : "text-muted-foreground")}>
              {WEEKDAY.format(parseIsoDay(day))} {dayNumber(day)}
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing scheduled</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {items.map((event) => (
                  <li key={`${event.kind}:${event.id}`}>
                    <Link href={event.href} className={cn("block hover:underline", chipClass(event))}>
                      {event.startTime ? <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{event.startTime}</span> : null}
                      {event.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function DayTimeline({ day, events }: { day: string; events: CalendarEvent[] }) {
  const timed = events.filter((e) => e.startTime !== null);
  const untimed = events.filter((e) => e.startTime === null);
  const intervals: Interval[] = [];
  for (const event of timed) {
    const interval = toInterval(event.startTime ?? "", event.endTime);
    if (interval) {
      intervals.push(interval);
    }
  }
  const gaps = findGaps(intervals, 120);

  return (
    <section aria-labelledby="day-heading" className="space-y-6">
      <h3 id="day-heading" className="text-sm font-medium">
        {DAY_LONG.format(parseIsoDay(day))}
      </h3>

      {timed.length === 0 && untimed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing on this day yet.
        </p>
      ) : null}

      {timed.length > 0 ? (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {timed.map((event) => (
            <li key={`${event.kind}:${event.id}`} className="relative">
              <span aria-hidden="true" className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-primary" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {event.startTime}
                {event.endTime ? `–${event.endTime}` : ""} · {KIND_LABEL[event.kind]}
              </p>
              <Link href={event.href} className={cn("text-sm font-medium hover:underline", chipClass(event))}>
                {event.title}
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {gaps.map((gap) => (
        <p key={`gap-${String(gap.startMin)}`} className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Free {formatClock(gap.startMin)}–{formatClock(gap.endMin)} ({String(Math.round(gap.minutes / 60))} h)
          {" · "}
          <Link href={`/activities/new?date=${day}&start=${formatClock(gap.startMin)}`} className="font-medium text-primary hover:underline">
            Add something
          </Link>
        </p>
      ))}

      {untimed.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Any time</h4>
          <ul className="space-y-1.5 text-sm">
            {untimed.map((event) => (
              <li key={`${event.kind}:${event.id}`}>
                <span className="mr-2 text-xs text-muted-foreground">{KIND_LABEL[event.kind]}</span>
                <Link href={event.href} className={cn("hover:underline", chipClass(event))}>
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
