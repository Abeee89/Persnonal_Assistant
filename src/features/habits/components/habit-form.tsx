"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { createHabitAction, updateHabitAction } from "../actions";
import type { HabitView } from "../service";

type FieldErrors = Record<string, string[]>;

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function HabitForm({ initial }: { initial?: HabitView }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string>(initial?.frequency ?? "daily");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = text(data, "targetPerPeriod");
    const payload = {
      name: text(data, "name"),
      description: text(data, "description") || null,
      frequency,
      intervalCount: 1,
      targetPerPeriod: frequency === "daily" || target === "" ? null : Number(target),
      color: text(data, "color") || null,
    };
    startTransition(async () => {
      setFormError(null);
      const result = initial
        ? await updateHabitAction({ id: initial.id, patch: payload })
        : await createHabitAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setErrors({});
      router.push(`/habits/${result.data.id}`);
      router.refresh();
    });
  }

  const err = (name: string) => {
    const message = errors[name]?.[0];
    return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <label className="block text-sm font-medium">
        Name
        <input name="name" required maxLength={80} defaultValue={initial?.name ?? ""} className={inputClass} />
        {err("name")}
      </label>

      <label className="block text-sm font-medium">
        Description
        <textarea name="description" rows={2} maxLength={500} defaultValue={initial?.description ?? ""} className={inputClass} />
        {err("description")}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Frequency
          <select
            name="frequency"
            value={frequency}
            onChange={(event) => {
              setFrequency(event.target.value);
            }}
            className={inputClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        {frequency === "daily" ? null : (
          <label className="block text-sm font-medium">
            Target per {frequency === "weekly" ? "week" : "month"}
            <input
              type="number"
              name="targetPerPeriod"
              min={1}
              max={frequency === "weekly" ? 7 : 31}
              defaultValue={initial?.targetPerPeriod ?? 3}
              className={inputClass}
            />
            {err("targetPerPeriod")}
          </label>
        )}
        <label className="block text-sm font-medium">
          Colour
          <input
            name="color"
            placeholder="#4C6EF5"
            defaultValue={initial?.color ?? ""}
            className={inputClass}
          />
          {err("color")}
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Create habit"}
        </button>
      </div>
    </form>
  );
}
