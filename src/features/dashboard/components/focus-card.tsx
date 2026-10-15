import Link from "next/link";
import type { DashboardSnapshot } from "../service";

/** The single rotating card (SDD §07). Renders nothing when there is nothing useful to say. */
export function FocusCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  if (snapshot.focus === "overdue") {
    return (
      <section aria-labelledby="focus-heading" className="rounded-lg border border-warning/50 bg-surface p-4">
        <h2 id="focus-heading" className="text-sm font-medium">
          {String(snapshot.tasks.overdue)} overdue {snapshot.tasks.overdue === 1 ? "task" : "tasks"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Clear them or move the due date.</p>
        <Link href="/tasks" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Open tasks
        </Link>
      </section>
    );
  }
  if (snapshot.focus === "reflection") {
    return (
      <section aria-labelledby="focus-heading" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="focus-heading" className="text-sm font-medium">
          Daily reflection
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">What did you accomplish today?</p>
        <Link href={`/journal/${snapshot.day}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Write today&apos;s entry
        </Link>
      </section>
    );
  }
  if (snapshot.focus === "goal" && snapshot.focusGoal) {
    return (
      <section aria-labelledby="focus-heading" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="focus-heading" className="text-sm font-medium">
          Goal in progress
        </h2>
        <p className="mt-1 text-sm">
          {snapshot.focusGoal.title} · {String(snapshot.focusGoal.progress)}%
        </p>
        <Link href={`/goals/${snapshot.focusGoal.id}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          View goal
        </Link>
      </section>
    );
  }
  return null;
}
