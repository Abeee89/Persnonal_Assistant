import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { HabitCheck } from "@/features/habits/components/habit-check";
import { HabitHeatmap } from "@/features/habits/components/habit-heatmap";
import { loadHabit } from "@/features/habits/queries";
import { localIsoDay } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: loadHabit(id)?.habit.name ?? "Habit" };
}

export default async function HabitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = loadHabit(id);
  if (!data) {
    notFound();
  }
  const { habit, heatmap } = data;
  const today = localIsoDay();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/habits" className="hover:underline">
          Habits
        </Link>
      </nav>
      <PageHeader
        title={habit.name}
        description={`${habit.frequency}${habit.targetPerPeriod ? ` · target ${String(habit.targetPerPeriod)} per ${habit.frequency === "weekly" ? "week" : "month"}` : ""}`}
        actions={
          <Link href={`/habits/${habit.id}/edit`} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
            Edit
          </Link>
        }
      />
      <div className="space-y-8">
        <section aria-labelledby="today-heading" className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 id="today-heading" className="sr-only">
            Today
          </h2>
          <HabitCheck habitId={habit.id} date={today} initialDone={habit.doneToday} label={`${habit.name} today`} />
          <dl className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Current streak</dt>
              <dd className="text-lg font-semibold tabular-nums">{String(habit.currentStreak)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Best streak</dt>
              <dd className="text-lg font-semibold tabular-nums">{String(habit.bestStreak)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completion</dt>
              <dd className="text-lg font-semibold tabular-nums">{String(habit.completionRate)}%</dd>
            </div>
          </dl>
        </section>
        <HabitHeatmap cells={heatmap} />
        {habit.description ? <p className="whitespace-pre-wrap text-sm">{habit.description}</p> : null}
      </div>
    </div>
  );
}
