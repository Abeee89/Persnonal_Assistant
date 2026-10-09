import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityEditForm } from "@/features/activities/components/activity-edit-form";
import { loadActivity, loadCategories } from "@/features/activities/queries";
import { localIsoDay } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = loadActivity(id);
  if (!activity) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Edit activity" description={activity.title} />
      <ActivityEditForm categories={loadCategories()} initial={activity} defaultDate={localIsoDay()} />
    </div>
  );
}
