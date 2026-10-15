import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchResults } from "@/features/search/components/search-results";
import { search } from "@/features/search/service";
import { getDb } from "@/db/runtime";
import { SearchBox } from "@/features/search/components/search-box";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q) ?? "";
  const hits = q.trim() === "" ? [] : search(getDb(), q, { limitPerKind: 10 });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader title="Search" description="Find anything you wrote, logged, planned or tracked." />
      <SearchBox initialQuery={q} />
      <div className="mt-6">
        {q.trim() === "" ? (
          <p className="text-sm text-muted-foreground">Type to search activities, tasks, goals, journal entries and habits.</p>
        ) : hits.length === 0 ? (
          <EmptyState title={`No matches for “${q.trim()}”`} description="Try a shorter word or check the spelling." />
        ) : (
          <SearchResults hits={hits} />
        )}
      </div>
    </div>
  );
}
