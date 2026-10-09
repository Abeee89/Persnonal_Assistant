"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { GOAL_STATUSES, PRIORITIES, PROGRESS_MODES } from "@/config/enums";
import type { CategoryOption } from "@/features/activities/components/activity-form";
import { createGoalAction, updateGoalAction } from "../actions";
import type { GoalView } from "../service";

type FieldErrors = Record<string, string[]>;

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_LABEL: Record<(typeof GOAL_STATUSES)[number], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export function GoalForm({
  categories,
  initial,
  onDone,
}: {
  categories: CategoryOption[];
  initial?: GoalView;
  onDone: (id: string) => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"auto" | "manual">(initial?.progressMode ?? "auto");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const manual = text(data, "manualProgress");
    const payload = {
      title: text(data, "title"),
      description: orNull(text(data, "description")),
      categoryId: orNull(text(data, "categoryId")),
      priority: text(data, "priority") || "medium",
      status: text(data, "status") || "not_started",
      progressMode: mode,
      manualProgress: mode === "manual" && manual !== "" ? Number(manual) : null,
      startDate: orNull(text(data, "startDate")),
      deadline: orNull(text(data, "deadline")),
      tags: text(data, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
    };
    startTransition(async () => {
      setFormError(null);
      const result = initial
        ? await updateGoalAction({ id: initial.id, patch: payload })
        : await createGoalAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setErrors({});
      onDone(result.data.id);
      router.refresh();
    });
  }

  const err = (name: string) => {
    const message = errors[name]?.[0];
    return message ? (
      <p className="mt-1 text-xs text-danger">{message}</p>
    ) : null;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <label className="block text-sm font-medium">
        Title
        <input name="title" required maxLength={200} defaultValue={initial?.title ?? ""} className={inputClass} />
        {err("title")}
      </label>

      <label className="block text-sm font-medium">
        Description
        <textarea name="description" rows={3} maxLength={5000} defaultValue={initial?.description ?? ""} className={inputClass} />
        {err("description")}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Start
          <input type="date" name="startDate" defaultValue={initial?.startDate ?? ""} className={inputClass} />
          {err("startDate")}
        </label>
        <label className="block text-sm font-medium">
          Deadline
          <input type="date" name="deadline" defaultValue={initial?.deadline ?? ""} className={inputClass} />
          {err("deadline")}
        </label>
        <label className="block text-sm font-medium">
          Priority
          <select name="priority" defaultValue={initial?.priority ?? "medium"} className={inputClass}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Category
          <select name="categoryId" defaultValue={initial?.categoryId ?? ""} className={inputClass}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoryId")}
        </label>
        <label className="block text-sm font-medium">
          Status
          <select name="status" defaultValue={initial?.status ?? "not_started"} className={inputClass}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Progress</legend>
        <div className="flex gap-4 text-sm">
          {PROGRESS_MODES.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input
                type="radio"
                name={`progress-mode-${initial?.id ?? "new"}`}
                checked={mode === m}
                onChange={() => {
                  setMode(m);
                }}
              />
              {m === "auto" ? "From milestones" : "Set manually"}
            </label>
          ))}
        </div>
        {mode === "manual" ? (
          <label className="block text-sm">
            Progress (0–100)
            <input
              type="number"
              name="manualProgress"
              min={0}
              max={100}
              defaultValue={initial?.manualProgress ?? 0}
              className={inputClass}
            />
            {err("manualProgress")}
          </label>
        ) : null}
      </fieldset>

      <label className="block text-sm font-medium">
        Tags
        <input name="tags" placeholder="learning, frontend" defaultValue={initial?.tags.join(", ") ?? ""} className={inputClass} />
        {err("tags")}
      </label>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Create goal"}
        </button>
      </div>
    </form>
  );
}
