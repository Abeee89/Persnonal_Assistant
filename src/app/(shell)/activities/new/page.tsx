import { PageHeader } from "@/components/shared/page-header";
import { ActivityCreateForm } from "@/features/activities/components/activity-create-page";
import { loadCategories } from "@/features/activities/queries";
import { localIsoDay } from "@/lib/domain/dates";

export const metadata = { title: "New activity" };
export const dynamic = "force-dynamic";

export default function NewActivityPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="New activity" description="Log something you did or plan to do." />
      <ActivityCreateForm categories={loadCategories()} defaultDate={localIsoDay()} />
    </div>
  );
}
