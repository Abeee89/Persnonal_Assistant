import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { JournalEditor } from "@/features/journal/components/journal-editor";
import { draftFrom, emptyDraft } from "@/features/journal/draft";
import { loadDay } from "@/features/journal/queries";
import { addDays, isIsoDay, localIsoDay } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: isIsoDay(date) ? `Journal ${date}` : "Journal" };
}

export default async function JournalDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isIsoDay(date)) {
    notFound();
  }
  const { entry, template, attachments } = loadDay(date);
  const draft = entry
    ? draftFrom(entry, attachments.map((item) => item.id))
    : emptyDraft(date, template.contentJson);
  const today = localIsoDay();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Day navigation" className="mb-2 flex items-center justify-between text-sm">
        <Link href={`/journal/${addDays(date, -1)}`} className="text-muted-foreground hover:underline">
          ← Previous day
        </Link>
        {date !== today ? (
          <Link href={`/journal/${today}`} className="text-muted-foreground hover:underline">
            Today
          </Link>
        ) : null}
        <Link href={`/journal/${addDays(date, 1)}`} className="text-muted-foreground hover:underline">
          Next day →
        </Link>
      </nav>
      <PageHeader title="Journal" description={date} />
      <JournalEditor key={date} initial={draft} initialAttachments={attachments} />
    </div>
  );
}
