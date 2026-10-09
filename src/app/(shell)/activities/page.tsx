import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityFilters } from "@/features/activities/components/activity-filters";
import { ActivityList } from "@/features/activities/components/activity-list";
import { loadActivityPage, loadCategories } from "@/features/activities/queries";

export const metadata = { title: "Activities" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const { items, nextCursor, query } = loadActivityPage(raw);
  const categories = loadCategories();
  const hasFilters = Boolean(query.q || query.categoryId || query.status || query.from || query.to);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Activities"
        description="Everything you did, planned or logged."
        actions={
          <Link
            href="/activities/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            New activity
          </Link>
        }
      />

      <div className="mb-4">
        <ActivityFilters categories={categories} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={hasFilters ? "No activities match these filters" : "No activities yet"}
          description={hasFilters ? "Try clearing a filter." : "Log what you did today to start your timeline."}
          action={
            hasFilters ? null : (
              <Link href="/activities/new" className="text-sm font-medium text-primary hover:underline">
                Add your first activity
              </Link>
            )
          }
        />
      ) : (
        <>
          <ActivityList items={items} />
          {nextCursor ? (
            <nav className="mt-4 flex justify-end" aria-label="Pagination">
              <Link
                href={{ pathname: "/activities", query: { ...raw, cursor: nextCursor } }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Next page
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
