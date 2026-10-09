"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { cn } from "@/lib/cn";
import { createTaskAction, setTaskStatusAction } from "../actions";
import type { TaskView } from "../service";
import type { Lane } from "@/lib/domain/task-lanes";

export const LANE_TITLES: Record<Lane, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  someday: "Someday",
  done: "Done",
};

const LANE_ORDER: Lane[] = ["overdue", "today", "week", "someday", "done"];

function TaskRow({ task, onChanged }: { task: TaskView; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = task.status === "done";

  function toggle() {
    startTransition(async () => {
      setError(null);
      const result = await setTaskStatusAction({ id: task.id, status: done ? "todo" : "done" });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onChanged();
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={toggle}
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
        className="mt-1 size-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={cn("text-sm font-medium hover:underline", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {[
            task.dueDate ? `Due ${task.dueDate}` : null,
            task.goalTitle ? `Goal: ${task.goalTitle}` : null,
            task.priority !== "medium" ? task.priority : null,
            ...task.tags.map((tag) => `#${tag}`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function QuickAdd({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await createTaskAction({
        title,
        dueDate: dueDate === "" ? null : dueDate,
        status: "todo",
        priority: "medium",
        tags: [],
      });
      if (!result.ok) {
        setError(result.fieldErrors?.title?.[0] ?? result.message);
        return;
      }
      setTitle("");
      setDueDate("");
      onCreated();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
      <label className="grid flex-1 gap-1 text-xs text-muted-foreground">
        New task
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          maxLength={200}
          placeholder="What needs doing?"
          aria-invalid={Boolean(error)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Due
        <input
          type="date"
          value={dueDate}
          onChange={(event) => {
            setDueDate(event.target.value);
          }}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending || title.trim() === ""}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        Add
      </button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function TaskLanes({ lanes }: { lanes: Record<Lane, TaskView[]> }) {
  const router = useRouter();
  const refresh = () => {
    router.refresh();
  };
  const total = LANE_ORDER.reduce((sum, lane) => sum + lanes[lane].length, 0);

  return (
    <div className="space-y-6">
      <QuickAdd onCreated={refresh} />

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No tasks yet. Type one above to start.
        </p>
      ) : null}

      {LANE_ORDER.map((lane) => {
        const items = lanes[lane];
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={lane} aria-labelledby={`lane-${lane}`}>
            <h2 id={`lane-${lane}`} className={cn("mb-2 text-sm font-medium", lane === "overdue" && "text-danger")}>
              {LANE_TITLES[lane]} <span className="font-normal text-muted-foreground">({items.length})</span>
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {items.map((task) => (
                <TaskRow key={task.id} task={task} onChanged={refresh} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
