import Link from "next/link";
import { Flag } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/features/goals/components/progress-bar";
import { loadGoals } from "@/features/goals/queries";
import { cn } from "@/lib/cn";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GoalsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const showArchived = raw.status === "all";
  const goals = loadGoals(showArchived);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        title="Goals"
        description="Longer-term outcomes, broken into milestones."
        actions={
          <Link
            href="/goals/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            New goal
          </Link>
        }
      />

      <nav aria-label="Goal filter" className="mb-4 flex gap-3 text-sm">
        <Link href="/goals" className={cn("hover:underline", !showArchived && "font-medium text-foreground", showArchived && "text-muted-foreground")}>
          Active
        </Link>
        <Link href="/goals?status=all" className={cn("hover:underline", showArchived && "font-medium text-foreground", !showArchived && "text-muted-foreground")}>
          All
        </Link>
      </nav>

      {goals.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No goals yet"
          description="Set one outcome you care about, then add the steps that get you there."
          action={
            <Link href="/goals/new" className="text-sm font-medium text-primary hover:underline">
              Create your first goal
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/goals/${goal.id}`} className="font-medium hover:underline">
                  {goal.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {goal.status.replace("_", " ")}
                  {goal.deadline ? ` · due ${goal.deadline}` : ""}
                </span>
              </div>
              <ProgressBar value={goal.progress} label={`${goal.title} progress`} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                {goal.milestoneTotal === 0
                  ? "No milestones yet"
                  : `${String(goal.milestoneDone)} of ${String(goal.milestoneTotal)} milestones done`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
