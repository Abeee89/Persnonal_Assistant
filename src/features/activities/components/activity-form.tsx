"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { cn } from "@/lib/cn";
import { ACTIVITY_STATUSES, PRIORITIES } from "@/config/enums";
import { createActivityAction, updateActivityAction } from "../actions";
import type { ActivityView } from "../service";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ActivityFormProps {
  categories: CategoryOption[];
  initial?: ActivityView;
  defaultDate: string;
  defaultStart?: string | null;
  onDone?: (id: string) => void;
}

type FieldErrors = Record<string, string[]>;

const STATUS_LABEL: Record<(typeof ACTIVITY_STATUSES)[number], string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABEL: Record<(typeof PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: FormDataEntryValue | null): string | null {
  const content = typeof value === "string" ? value.trim() : "";
  return content === "" ? null : content;
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = nullable(value);
  return text === null ? null : Number(text);
}

export function ActivityForm({ categories, initial, defaultDate, defaultStart = null, onDone }: ActivityFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const startDefault = initial?.startTime ?? defaultStart ?? "";

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      title: text(data, "title"),
      description: nullable(data.get("description")),
      categoryId: nullable(data.get("categoryId")),
      goalId: null,
      date: text(data, "date"),
      allDay,
      startTime: allDay ? null : nullable(data.get("startTime")),
      endTime: allDay ? null : nullable(data.get("endTime")),
      status: text(data, "status") || "planned",
      priority: text(data, "priority") || "medium",
      location: nullable(data.get("location")),
      mood: nullableNumber(data.get("mood")),
      energyLevel: nullableNumber(data.get("energyLevel")),
      tags: parseTags(text(data, "tags")),
    };

    startTransition(async () => {
      setFormError(null);
      const result = initial
        ? await updateActivityAction({ id: initial.id, patch: payload })
        : await createActivityAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setErrors({});
      onDone?.(result.data.id);
      router.refresh();
    });
  }

  const fieldError = (name: string) => {
    const message = errors[name]?.[0];
    return message ? (
      <p id={`${name}-error`} className="mt-1 text-xs text-danger">
        {message}
      </p>
    ) : null;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-describedby={formError ? "form-error" : undefined}>
      {formError ? (
        <p id="form-error" role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <label className="block text-sm font-medium">
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
          className={inputClass}
        />
        {fieldError("title")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Date
          <input
            type="date"
            name="date"
            required
            defaultValue={initial?.date ?? defaultDate}
            aria-invalid={Boolean(errors.date)}
            className={inputClass}
          />
          {fieldError("date")}
        </label>
        <label className="block text-sm font-medium">
          Category
          <select name="categoryId" defaultValue={initial?.categoryId ?? ""} className={inputClass}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldError("categoryId")}
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Time</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(event) => { setAllDay(event.target.checked); }} />
          All day
        </label>
        {allDay ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Start
              <input type="time" name="startTime" defaultValue={startDefault} className={inputClass} />
              {fieldError("startTime")}
            </label>
            <label className="block text-sm">
              End
              <input type="time" name="endTime" defaultValue={initial?.endTime ?? ""} className={inputClass} aria-invalid={Boolean(errors.endTime)} />
              {fieldError("endTime")}
            </label>
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Status
          <select name="status" defaultValue={initial?.status ?? "planned"} className={inputClass}>
            {ACTIVITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Priority
          <select name="priority" defaultValue={initial?.priority ?? "medium"} className={inputClass}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Mood (1–5)
          <input type="number" name="mood" min={1} max={5} defaultValue={initial?.mood ?? ""} className={inputClass} />
          {fieldError("mood")}
        </label>
        <label className="block text-sm font-medium">
          Energy (1–5)
          <input type="number" name="energyLevel" min={1} max={5} defaultValue={initial?.energyLevel ?? ""} className={inputClass} />
          {fieldError("energyLevel")}
        </label>
        <label className="block text-sm font-medium">
          Location
          <input name="location" maxLength={120} defaultValue={initial?.location ?? ""} className={inputClass} />
          {fieldError("location")}
        </label>
      </div>

      <label className="block text-sm font-medium">
        Tags
        <input
          name="tags"
          placeholder="deepwork, client-x"
          defaultValue={initial?.tags.join(", ") ?? ""}
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">Separate with commas.</span>
        {fieldError("tags")}
      </label>

      <label className="block text-sm font-medium">
        Notes
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={initial?.description ?? ""}
          className={cn(inputClass, "resize-y")}
        />
        {fieldError("description")}
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Add activity"}
        </button>
      </div>
    </form>
  );
}
