import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { loadCategories } from "@/features/activities/queries";
import { GoalEditForm } from "@/features/goals/components/goal-edit-form";
import { loadGoal } from "@/features/goals/queries";

export const dynamic = "force-dynamic";

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = loadGoal(id);
  if (!goal) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Edit goal" description={goal.title} />
      <GoalEditForm categories={loadCategories()} initial={goal} />
    </div>
  );
}
