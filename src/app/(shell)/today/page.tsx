import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { loadDashboard } from "@/features/dashboard/queries";
import { loadPreferences } from "@/features/preferences/queries";
import { addDays, isIsoDay, localIsoDay } from "@/lib/domain/dates";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const requested = Array.isArray(raw.date) ? raw.date[0] : raw.date;
  if (requested !== undefined && !isIsoDay(requested)) {
    notFound();
  }
  const today = localIsoDay();
  const day = requested ?? today;
  const { snapshot, hour } = loadDashboard(day, new Date().getHours());

  return (
    <div>
      <nav aria-label="Day navigation" className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 text-sm md:px-8">
        <Link href={`/today?date=${addDays(day, -1)}`} className="text-muted-foreground hover:underline">
          ← Previous day
        </Link>
        {day !== today ? (
          <Link href="/today" className="text-muted-foreground hover:underline">
            Back to today
          </Link>
        ) : null}
        <Link href={`/today?date=${addDays(day, 1)}`} className="text-muted-foreground hover:underline">
          Next day →
        </Link>
      </nav>
      <DashboardView snapshot={snapshot} name={loadPreferences().displayName} hour={hour} />
    </div>
  );
}
