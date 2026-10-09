"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ChangeEvent } from "react";
import { ACTIVITY_STATUSES } from "@/config/enums";
import type { CategoryOption } from "./activity-form";

const selectClass =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ActivityFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("cursor");
    startTransition(() => {
      router.push(`/activities?${next.toString()}`);
    });
  }

  const onChange = (key: string) => (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    update(key, event.target.value);
  };

  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter activities">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Search
        <input
          type="search"
          defaultValue={params.get("q") ?? ""}
          maxLength={200}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              update("q", event.currentTarget.value.trim());
            }
          }}
          className={selectClass}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Category
        <select value={params.get("categoryId") ?? ""} onChange={onChange("categoryId")} className={selectClass}>
          <option value="">All</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Status
        <select value={params.get("status") ?? ""} onChange={onChange("status")} className={selectClass}>
          <option value="">All</option>
          {ACTIVITY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Sort
        <select value={params.get("sort") ?? "date_desc"} onChange={onChange("sort")} className={selectClass}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
        </select>
      </label>
    </div>
  );
}
