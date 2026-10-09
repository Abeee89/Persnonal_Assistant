"use client";

import { useRouter } from "next/navigation";
import { ActivityForm, type CategoryOption } from "./activity-form";

export function ActivityCreateForm({ categories, defaultDate }: { categories: CategoryOption[]; defaultDate: string }) {
  const router = useRouter();
  return (
    <ActivityForm
      categories={categories}
      defaultDate={defaultDate}
      onDone={(id) => {
        router.push(`/activities/${id}`);
      }}
    />
  );
}
