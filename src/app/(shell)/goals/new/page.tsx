import { PageHeader } from "@/components/shared/page-header";
import { GoalCreateForm } from "@/features/goals/components/goal-create-form";
import { loadCategories } from "@/features/activities/queries";

export const metadata = { title: "New goal" };
export const dynamic = "force-dynamic";

export default function NewGoalPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="New goal" description="Name the outcome. You can add milestones after saving." />
      <GoalCreateForm categories={loadCategories()} />
    </div>
  );
}
