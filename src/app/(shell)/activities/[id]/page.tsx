import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityActions } from "@/features/activities/components/activity-actions";
import { loadActivity } from "@/features/activities/queries";
import { AttachmentPanel } from "@/features/attachments/components/attachment-panel";
import { loadAttachments } from "@/features/attachments/queries";
import { formatDuration } from "@/lib/domain/duration";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = loadActivity(id);
  return { title: activity?.title ?? "Activity" };
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = loadActivity(id);
  if (!activity) {
    notFound();
  }

  const timing = activity.allDay
    ? "All day"
    : activity.startTime && activity.endTime
      ? `${activity.startTime}–${activity.endTime} (${formatDuration(activity.durationMinutes)})`
      : (activity.startTime ?? "No time set");

  const files = loadAttachments("activity", activity.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/activities" className="hover:underline">
          Activities
        </Link>
      </nav>
      <PageHeader title={activity.title} description={`${activity.date} · ${timing}`} />
      <div className="space-y-6">
        <ActivityActions activity={activity} />
        <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="capitalize">{activity.priority}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Location</dt>
            <dd>{activity.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mood</dt>
            <dd>{activity.mood ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Energy</dt>
            <dd>{activity.energyLevel ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Tags</dt>
            <dd>{activity.tags.length > 0 ? activity.tags.map((tag) => `#${tag}`).join(" ") : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap">{activity.description ?? "—"}</dd>
          </div>
        </dl>
        <AttachmentPanel entityType="activity" entityId={activity.id} initial={files} />
      </div>
    </div>
  );
}
