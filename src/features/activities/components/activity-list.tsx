import Link from "next/link";
import { formatDuration } from "@/lib/domain/duration";
import { cn } from "@/lib/cn";
import type { ActivityView } from "../service";

const STATUS_CLASS: Record<ActivityView["status"], string> = {
  planned: "border-border text-muted-foreground",
  in_progress: "border-primary/40 text-primary",
  done: "border-success/40 text-success",
  cancelled: "border-border text-muted-foreground line-through",
};

const STATUS_LABEL: Record<ActivityView["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function ActivityList({ items }: { items: ActivityView[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <time dateTime={item.date} className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
            {item.date}
          </time>
          <div className="min-w-0 flex-1">
            <Link href={`/activities/${item.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:underline">
              {item.title}
            </Link>
            <p className="text-xs text-muted-foreground tabular-nums">
              {item.allDay
                ? "All day"
                : item.startTime && item.endTime
                  ? `${item.startTime}–${item.endTime} · ${formatDuration(item.durationMinutes)}`
                  : item.startTime ?? "No time"}
              {item.tags.length > 0 ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
            </p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[item.status])}>
            {STATUS_LABEL[item.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
