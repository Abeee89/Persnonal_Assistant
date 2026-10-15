import { PageHeader } from "@/components/shared/page-header";
import { ActivityCreateForm } from "@/features/activities/components/activity-create-page";
import { loadCategories } from "@/features/activities/queries";
import { isIsoDay, localIsoDay } from "@/lib/domain/dates";
import { optionalTimeOfDay } from "@/schemas/common";

export const metadata = { title: "New activity" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const dateParam = firstOf(raw.date);
  const startParam = firstOf(raw.start);
  const defaultDate = dateParam && isIsoDay(dateParam) ? dateParam : localIsoDay();
  const startCheck = startParam ? optionalTimeOfDay.safeParse(startParam) : null;
  const defaultStart = startCheck?.success && startCheck.data ? startCheck.data : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="New activity" description="Log something you did or plan to do." />
      <ActivityCreateForm categories={loadCategories()} defaultDate={defaultDate} defaultStart={defaultStart} />
    </div>
  );
}
