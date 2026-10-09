import { CalendarDays, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader title="Dashboard" description="Today at a glance." />
      <EmptyState
        icon={Sparkles}
        title="Nothing logged yet"
        description="Activities, tasks and habits will appear here once the features ship."
        action={
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            Design system step complete
          </span>
        }
      />
    </div>
  );
}
