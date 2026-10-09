"use client";

import { useRouter } from "next/navigation";
import { ActivityForm, type CategoryOption } from "./activity-form";
import type { ActivityView } from "../service";

export function ActivityEditForm({
  categories,
  initial,
  defaultDate,
}: {
  categories: CategoryOption[];
  initial: ActivityView;
  defaultDate: string;
}) {
  const router = useRouter();
  return (
    <ActivityForm
      categories={categories}
      initial={initial}
      defaultDate={defaultDate}
      onDone={(id) => {
        router.push(`/activities/${id}`);
      }}
    />
  );
}
