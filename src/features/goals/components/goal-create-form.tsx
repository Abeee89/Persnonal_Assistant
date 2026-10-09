"use client";

import { useRouter } from "next/navigation";
import type { CategoryOption } from "@/features/activities/components/activity-form";
import { GoalForm } from "./goal-form";

export function GoalCreateForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  return (
    <GoalForm
      categories={categories}
      onDone={(id) => {
        router.push(`/goals/${id}`);
      }}
    />
  );
}
