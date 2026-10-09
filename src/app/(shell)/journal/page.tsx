import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { loadMonth } from "@/features/journal/queries";
import { localIsoDay } from "@/lib/domain/dates";
import { cn } from "@/lib/cn";

export const metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function monthOf(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const today = localIsoDay();
  const month = monthOf(Array.isArray(raw.month) ? raw.month[0] : raw.month, today.slice(0, 7));
  const entries = loadMonth(month);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        title="Journal"
        description={`${month} · ${String(entries.length)} ${entries.length === 1 ? "entry" : "entries"}`}
        actions={
          <Link
            href={`/journal/${today}`}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Today&apos;s entry
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No entries this month"
          description="Write a few lines about your day. It saves as you type."
          action={
            <Link href={`/journal/${today}`} className="text-sm font-medium text-primary hover:underline">
              Start today&apos;s entry
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link href={`/journal/${entry.date}`} className="block px-4 py-3 hover:bg-accent/50">
                <div className="flex items-center justify-between gap-3">
                  <time dateTime={entry.date} className="text-sm font-medium tabular-nums">
                    {entry.date}
                  </time>
                  <span
                    className={cn(
                      "text-xs",
                      entry.status === "final" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {entry.status === "final" ? "Final" : "Draft"}
                    {entry.mood !== null ? ` · mood ${String(entry.mood)}` : ""}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.preview || "Empty entry"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
