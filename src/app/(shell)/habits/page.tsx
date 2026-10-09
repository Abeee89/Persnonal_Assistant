import Link from "next/link";
import { Repeat } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HabitList } from "@/features/habits/components/habit-list";
import { loadHabits } from "@/features/habits/queries";

export const metadata = { title: "Habits" };
export const dynamic = "force-dynamic";

export default function HabitsPage() {
  const { habits, today } = loadHabits(false);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        title="Habits"
        description="Small things, repeated. Check off today."
        actions={
          <Link
            href="/habits/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            New habit
          </Link>
        }
      />
      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Pick one thing you want to do most days. Start small."
          action={
            <Link href="/habits/new" className="text-sm font-medium text-primary hover:underline">
              Add your first habit
            </Link>
          }
        />
      ) : (
        <HabitList habits={habits} today={today} />
      )}
    </div>
  );
}
