import Link from "next/link";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { greetingFor } from "@/lib/domain/focus";
import { parseIsoDay } from "@/lib/domain/dates";
import { HabitList } from "@/features/habits/components/habit-list";
import type { DashboardSnapshot } from "../service";
import { FocusCard } from "./focus-card";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function DashboardView({
  snapshot,
  name,
  hour,
}: {
  snapshot: DashboardSnapshot;
  name: string | null;
  hour: number;
}) {
  const greeting = greetingFor(hour);
  const hasAnything =
    snapshot.activitiesToday > 0 ||
    snapshot.tasks.total > 0 ||
    snapshot.habits.total > 0 ||
    snapshot.activeGoals > 0 ||
    snapshot.todayJournal !== null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-muted-foreground">{DAY.format(parseIsoDay(snapshot.day))}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {greeting}
          {name ? `, ${name}` : ""}
        </h1>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Activities" value={String(snapshot.activitiesToday)} href="/calendar?view=day" />
        <StatCard
          label="Tasks"
          value={`${String(snapshot.tasks.done)} / ${String(snapshot.tasks.total)}`}
          hint={snapshot.tasks.overdue > 0 ? `${String(snapshot.tasks.overdue)} overdue` : "due today"}
          href="/tasks"
        />
        <StatCard
          label="Habits"
          value={`${String(snapshot.habits.done)} / ${String(snapshot.habits.total)}`}
          hint="checked today"
          href="/habits"
        />
        <StatCard
          label="Goals"
          value={snapshot.goalAverage === null ? "—" : `${String(snapshot.goalAverage)}%`}
          hint={snapshot.activeGoals === 0 ? "none active" : `${String(snapshot.activeGoals)} active`}
          href="/goals"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/activities/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Add activity
        </Link>
        <Link href={`/journal/${snapshot.day}`} className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-accent">
          Journal
        </Link>
        <Link href="/tasks" className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-accent">
          Add task
        </Link>
      </div>

      {!hasAnything ? (
        <EmptyState
          title="A quiet start"
          description="Add an activity, a task, or a habit to begin. Everything here updates as you go."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="timeline-heading" className="space-y-3 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 id="timeline-heading" className="text-sm font-medium">
              Today&apos;s timeline
            </h2>
            <Link href={`/calendar?view=day&date=${snapshot.day}`} className="text-xs text-muted-foreground hover:underline">
              Open day
            </Link>
          </div>
          {snapshot.timeline.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing timed yet today.
            </p>
          ) : (
            <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
              {snapshot.timeline.slice(0, 8).map((event) => (
                <li key={`${event.kind}:${event.id}`} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{event.startTime ?? "—"}</span>
                  <Link href={event.href} className="min-w-0 flex-1 truncate hover:underline">
                    {event.title}
                  </Link>
                  <span className="text-xs capitalize text-muted-foreground">{event.kind}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <FocusCard snapshot={snapshot} />
          {snapshot.recentJournal ? (
            <section aria-labelledby="recent-heading" className="rounded-lg border border-border bg-surface p-4">
              <h2 id="recent-heading" className="text-sm font-medium">
                Recent journal · {snapshot.recentJournal.date}
              </h2>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{snapshot.recentJournal.preview}</p>
              <Link href={`/journal/${snapshot.recentJournal.date}`} className="mt-2 inline-block text-xs text-primary hover:underline">
                Read entry
              </Link>
            </section>
          ) : null}
        </aside>
      </div>

      {snapshot.habitList.length > 0 ? (
        <section aria-labelledby="habits-heading" className="space-y-3">
          <h2 id="habits-heading" className="text-sm font-medium">
            Habits
          </h2>
          <HabitList habits={snapshot.habitList} today={snapshot.day} />
        </section>
      ) : null}
    </div>
  );
}
