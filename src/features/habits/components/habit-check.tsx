"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { toggleHabitLogAction } from "../actions";

/**
 * Check button with optimistic flip. The server result is authoritative:
 * on success its `done` value replaces the optimistic one, and on failure it reverts.
 */
export function HabitCheck({
  habitId,
  date,
  initialDone,
  label,
  size = "md",
  onChanged,
}: {
  habitId: string;
  date: string;
  initialDone: boolean;
  label: string;
  size?: "sm" | "md";
  onChanged?: () => void;
}) {
  const [serverDone, setServerDone] = useState(initialDone);
  const [optimistic, setOptimistic] = useOptimistic(serverDone);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setError(null);
      setOptimistic(next);
      const result = await toggleHabitLogAction({ habitId, date, expectedDone: optimistic });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setServerDone(result.data.done);
      onChanged?.();
    });
  }

  const box = size === "sm" ? "size-7" : "size-10";

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        role="checkbox"
        aria-checked={optimistic}
        aria-label={`${label}: ${optimistic ? "done" : "not done"}`}
        disabled={pending}
        onClick={toggle}
        className={cn(
          box,
          "inline-flex items-center justify-center rounded-md border transition-colors disabled:opacity-60",
          optimistic ? "border-success bg-success/15 text-success" : "border-border text-muted-foreground hover:bg-accent",
        )}
      >
        <span aria-hidden="true" className="text-sm font-semibold">
          {optimistic ? "✓" : ""}
        </span>
      </button>
      {error ? (
        <span role="alert" className="mt-1 max-w-40 text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
