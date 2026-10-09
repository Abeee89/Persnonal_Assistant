"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { addMilestoneAction, deleteGoalAction, deleteMilestoneAction, toggleMilestoneAction } from "../actions";
import type { GoalView } from "../service";
import { ProgressBar } from "./progress-bar";

export function GoalDetail({ goal }: { goal: GoalView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  function run(task: () => Promise<{ ok: boolean; message?: string }>, done?: () => void) {
    startTransition(async () => {
      setMessage(null);
      const result = await task();
      if (!result.ok) {
        setMessage(result.message ?? "Something went wrong.");
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function addMilestone(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (title === "") {
      return;
    }
    run(() => addMilestoneAction({ goalId: goal.id, title }), () => {
      setNewTitle("");
    });
  }

  function remove() {
    if (!window.confirm("Delete this goal? Linked tasks and activities are kept.")) {
      return;
    }
    run(() => deleteGoalAction({ id: goal.id }), () => {
      router.push("/goals");
    });
  }

  const modeNote = goal.progressMode === "auto" ? "From completed milestones" : "Set manually";
  const done = goal.milestones.filter((m) => m.done).length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="progress-heading" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="progress-heading" className="text-sm font-medium">
          Progress
        </h2>
        <ProgressBar value={goal.progress} label={`${goal.title} progress`} />
        <p className="text-xs text-muted-foreground">
          {modeNote}
          {goal.progressMode === "auto" ? ` · ${String(done)} of ${String(goal.milestones.length)} milestones done` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/goals/${goal.id}/edit`} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
            Edit
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-danger hover:bg-accent disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </section>

      <section aria-labelledby="milestones-heading" className="space-y-3">
        <h2 id="milestones-heading" className="text-sm font-medium">
          Milestones
        </h2>
        {goal.milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones yet. Break the goal into steps below.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {goal.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={m.done}
                  disabled={pending}
                  aria-label={`Mark "${m.title}" ${m.done ? "not done" : "done"}`}
                  onChange={(event) => {
                    run(() => toggleMilestoneAction({ id: m.id, done: event.target.checked }));
                  }}
                  className="size-4"
                />
                <span className={m.done ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>{m.title}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    run(() => deleteMilestoneAction({ id: m.id }));
                  }}
                  className="text-xs text-muted-foreground hover:text-danger disabled:opacity-60"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addMilestone} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(event) => {
              setNewTitle(event.target.value);
            }}
            maxLength={200}
            placeholder="Add a milestone"
            aria-label="New milestone"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={pending || newTitle.trim() === ""}
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60"
          >
            Add
          </button>
        </form>
      </section>

      <section aria-labelledby="linked-heading" className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 id="linked-heading" className="mb-2 text-sm font-medium">
            Linked tasks
          </h2>
          {goal.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks linked.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {goal.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">({t.status.replace("_", " ")})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium">Linked activities</h2>
          {goal.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities linked.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {goal.activities.map((a) => (
                <li key={a.id}>
                  <Link href={`/activities/${a.id}`} className="hover:underline">
                    {a.title}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">{a.date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
