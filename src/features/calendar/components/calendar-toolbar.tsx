import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CALENDAR_VIEWS, EVENT_KINDS, type CalendarView, type EventKind } from "@/config/enums";
import { cn } from "@/lib/cn";
import { calendarHref, type CalendarState } from "../url-state";

export const KIND_LABEL: Record<EventKind, string> = {
  activity: "Activities",
  task: "Tasks",
  goal: "Goal deadlines",
  habit: "Habits",
  journal: "Journal",
};

const VIEW_LABEL: Record<CalendarView, string> = { month: "Month", week: "Week", day: "Day" };

export function CalendarToolbar({
  state,
  prev,
  next,
  today,
  title,
}: {
  state: CalendarState;
  prev: string;
  next: string;
  today: string;
  title: string;
}) {
  const base = { view: state.view, kinds: state.kinds };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={calendarHref({ ...base, anchor: prev })}
            aria-label={`Previous ${state.view}`}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={calendarHref({ ...base, anchor: today })}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
          >
            Today
          </Link>
          <Link
            href={calendarHref({ ...base, anchor: next })}
            aria-label={`Next ${state.view}`}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
          <h2 className="ml-2 text-base font-medium" aria-live="polite">
            {title}
          </h2>
        </div>
        <nav aria-label="Calendar view" className="inline-flex rounded-md border border-border p-0.5">
          {CALENDAR_VIEWS.map((view) => (
            <Link
              key={view}
              href={calendarHref({ view, anchor: state.anchor, kinds: state.kinds })}
              aria-current={view === state.view ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-[5px] px-3 text-sm",
                view === state.view ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABEL[view]}
            </Link>
          ))}
        </nav>
      </div>

      <nav aria-label="Show item types" className="flex flex-wrap gap-2 text-xs">
        {EVENT_KINDS.map((kind) => {
          const active = state.kinds.includes(kind);
          const nextKinds = active ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind];
          return (
            <Link
              key={kind}
              href={calendarHref({ ...base, kinds: nextKinds.length === 0 ? [...EVENT_KINDS] : nextKinds, anchor: state.anchor })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3",
                active ? "border-primary/40 bg-accent text-foreground" : "border-border text-muted-foreground line-through",
              )}
            >
              {KIND_LABEL[kind]}
              <span className="sr-only">{active ? " (shown)" : " (hidden)"}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
