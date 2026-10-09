import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { HabitForm } from "@/features/habits/components/habit-form";
import { loadHabit } from "@/features/habits/queries";

export const dynamic = "force-dynamic";

export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = loadHabit(id);
  if (!data) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Edit habit" description={data.habit.name} />
      <HabitForm initial={data.habit} />
    </div>
  );
}
