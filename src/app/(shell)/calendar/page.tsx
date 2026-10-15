import { PageHeader } from "@/components/shared/page-header";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { DayTimeline, MonthGrid, WeekList } from "@/features/calendar/components/calendar-views";
import { loadCalendar } from "@/features/calendar/queries";
import { parseCalendarState } from "@/features/calendar/url-state";
import { localIsoDay, parseIsoDay } from "@/lib/domain/dates";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTH_TITLE = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEK_RANGE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function titleFor(view: string, anchor: string, days: string[]): string {
  const date = parseIsoDay(anchor);
  if (view === "month") {
    return MONTH_TITLE.format(date);
  }
  if (view === "week") {
    const first = days[0] ?? anchor;
    const last = days[days.length - 1] ?? anchor;
    return `${WEEK_RANGE.format(parseIsoDay(first))} – ${WEEK_RANGE.format(parseIsoDay(last))}`;
  }
  return WEEK_RANGE.format(date);
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const today = localIsoDay();
  const state = parseCalendarState(raw, today);
  const data = loadCalendar(state, 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader title="Calendar" description="Activities, tasks, goal deadlines, habits and journal days." />
      <div className="space-y-6">
        <CalendarToolbar
          state={state}
          prev={data.prev}
          next={data.next}
          today={today}
          title={titleFor(state.view, state.anchor, data.days)}
        />
        {state.view === "month" ? (
          <MonthGrid days={data.days} anchorMonth={state.anchor.slice(0, 7)} eventsByDay={data.eventsByDay} today={today} />
        ) : null}
        {state.view === "week" ? <WeekList days={data.days} eventsByDay={data.eventsByDay} today={today} /> : null}
        {state.view === "day" ? (
          <DayTimeline day={state.anchor} events={data.eventsByDay[state.anchor] ?? []} />
        ) : null}
      </div>
    </div>
  );
}
