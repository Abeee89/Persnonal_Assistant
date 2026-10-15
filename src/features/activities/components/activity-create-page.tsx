"use client";

import { useRouter } from "next/navigation";
import { ActivityForm, type CategoryOption } from "./activity-form";

export function ActivityCreateForm({
  categories,
  defaultDate,
  defaultStart,
}: {
  categories: CategoryOption[];
  defaultDate: string;
  defaultStart?: string | null;
}) {
  const router = useRouter();
  return (
    <ActivityForm
      categories={categories}
      defaultDate={defaultDate}
      defaultStart={defaultStart ?? null}
      onDone={(id) => {
        router.push(`/activities/${id}`);
      }}
    />
  );
}
