import { PageHeader } from "@/components/shared/page-header";
import { HabitForm } from "@/features/habits/components/habit-form";

export const metadata = { title: "New habit" };

export default function NewHabitPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="New habit" description="Daily, weekly or monthly. Weekly and monthly count a target number of days." />
      <HabitForm />
    </div>
  );
}
