import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { STATS_PERIODS } from "@/config/enums";
import { cn } from "@/lib/cn";
import { localIsoDay } from "@/lib/domain/dates";
import { periodLabel, shiftPeriod } from "@/lib/domain/stats-window";
import { StatisticsView } from "@/features/statistics/components/statistics-view";
import { loadStats } from "@/features/statistics/queries";
import { parseStatsState, statsHref } from "@/features/statistics/url-state";

export const metadata = { title: "Statistics" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PERIOD_LABEL = { day: "Day", week: "Week", month: "Month" } as const;

export default async function StatisticsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const today = localIsoDay();
  const state = parseStatsState(raw, today);
  const stats = loadStats(state.period, state.anchor);
  const label = periodLabel(stats.window);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader title="Statistics" description="Counts for the period you choose. Charts come later." />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={statsHref({ period: state.period, anchor: shiftPeriod(state.period, state.anchor, -1) })}
            aria-label="Previous period"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link href={statsHref({ period: state.period, anchor: today })} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
            This {state.period}
          </Link>
          <Link
            href={statsHref({ period: state.period, anchor: shiftPeriod(state.period, state.anchor, 1) })}
            aria-label="Next period"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
          <h2 className="ml-2 text-base font-medium" aria-live="polite">
            {label}
          </h2>
        </div>
        <nav aria-label="Statistics period" className="inline-flex rounded-md border border-border p-0.5">
          {STATS_PERIODS.map((period) => (
            <Link
              key={period}
              href={statsHref({ period, anchor: state.anchor })}
              aria-current={period === state.period ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-[5px] px-3 text-sm",
                period === state.period ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[period]}
            </Link>
          ))}
        </nav>
      </div>

      <StatisticsView stats={stats} label={label} />
    </div>
  );
}
