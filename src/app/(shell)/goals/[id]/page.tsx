import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GoalDetail } from "@/features/goals/components/goal-detail";
import { loadGoal } from "@/features/goals/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: loadGoal(id)?.title ?? "Goal" };
}

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = loadGoal(id);
  if (!goal) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/goals" className="hover:underline">
          Goals
        </Link>
      </nav>
      <PageHeader
        title={goal.title}
        description={[goal.deadline ? `Deadline ${goal.deadline}` : null, goal.status.replace("_", " ")]
          .filter(Boolean)
          .join(" · ")}
      />
      {goal.description ? <p className="mb-6 whitespace-pre-wrap text-sm">{goal.description}</p> : null}
      <GoalDetail goal={goal} />
    </div>
  );
}
