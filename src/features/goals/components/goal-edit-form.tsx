"use client";

import { useRouter } from "next/navigation";
import type { CategoryOption } from "@/features/activities/components/activity-form";
import { GoalForm } from "./goal-form";
import type { GoalView } from "../service";

export function GoalEditForm({ categories, initial }: { categories: CategoryOption[]; initial: GoalView }) {
  const router = useRouter();
  return (
    <GoalForm
      categories={categories}
      initial={initial}
      onDone={(id) => {
        router.push(`/goals/${id}`);
      }}
    />
  );
}
