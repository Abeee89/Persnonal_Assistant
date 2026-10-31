import { StatCard } from "@/components/shared/stat-card";
import { formatDuration } from "@/lib/domain/duration";
import type { StatsSnapshot } from "../service";

function MoodTrend({ stats }: { stats: StatsSnapshot }) {
  if (stats.moodPoints.length === 0) {
    return <p className="text-sm text-muted-foreground">No mood logged in this period.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {stats.moodPoints.map((point) => (
        <li key={point.day} className="rounded-md border border-border px-2 py-1 text-xs" title={point.day}>
          <span className="text-muted-foreground">{point.day.slice(5)}</span>{" "}
          <span className="font-medium tabular-nums">{point.mood}/5</span>
        </li>
      ))}
    </ul>
  );
}

function CategoryMix({ stats }: { stats: StatsSnapshot }) {
  if (stats.categoryMix.length === 0) {
    return <p className="text-sm text-muted-foreground">No activities in this period.</p>;
  }
  const max = Math.max(...stats.categoryMix.map((slice) => slice.count), 1);
  return (
    <ul className="space-y-2">
      {stats.categoryMix.map((slice) => (
        <li key={slice.categoryId ?? "none"} className="space-y-1">
          <div className="flex items-baseline justify-between text-sm">
            <span>{slice.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {slice.count} · {formatDuration(slice.minutes)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${String(Math.round((slice.count / max) * 100))}%`, backgroundColor: slice.color ?? "var(--primary)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatisticsView({ stats, label }: { stats: StatsSnapshot; label: string }) {
  return (
    <div className="space-y-8">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Activities" value={String(stats.activityCount)} hint="logged this period" />
        <StatCard label="Logged time" value={formatDuration(stats.totalMinutes)} hint={`${formatDuration(stats.productiveMinutes)} productive`} />
        <StatCard label="Tasks" value={`${String(stats.tasksDone)} / ${String(stats.tasksDue)}`} hint={`${String(stats.taskCompletionRate)}% completed`} />
        <StatCard
          label="Habits"
          value={`${String(stats.habitConsistency)}%`}
          hint={`${String(stats.habitsHit)} of ~${String(stats.habitsExpected)} check-ins`}
        />
        <StatCard label="Journal" value={String(stats.journalCount)} hint={`${String(stats.journaledDays)} of ${String(stats.window.days)} days`} />
        <StatCard label="Average mood" value={stats.averageMood === null ? "—" : `${String(stats.averageMood)}/5`} hint={label} />
        <StatCard label="Productivity score" value={String(stats.productivityScore)} hint="weighted, 0–100" />
      </section>

      <section aria-labelledby="mix-heading" className="space-y-3">
        <h2 id="mix-heading" className="text-sm font-medium">
          Where the time went
        </h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <CategoryMix stats={stats} />
        </div>
      </section>

      <section aria-labelledby="mood-heading" className="space-y-3">
        <h2 id="mood-heading" className="text-sm font-medium">
          Mood
        </h2>
        <div className="rounded-lg border border-border bg-surface p-4">
          <MoodTrend stats={stats} />
        </div>
      </section>
    </div>
  );
}
