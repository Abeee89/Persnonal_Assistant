"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TASK_STATUSES } from "@/config/enums";
import { deleteTaskAction, setTaskStatusAction } from "../actions";
import type { TaskView } from "../service";

const buttonClass =
  "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60";

export function TaskDetailActions({ task }: { task: TaskView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function setStatus(status: (typeof TASK_STATUSES)[number]) {
    startTransition(async () => {
      setMessage(null);
      const result = await setTaskStatusAction({ id: task.id, status });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this task?")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTaskAction({ id: task.id });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.push("/tasks");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            value={task.status}
            disabled={pending}
            onChange={(event) => {
              setStatus(event.target.value as (typeof TASK_STATUSES)[number]);
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setStatus(task.status === "done" ? "todo" : "done");
          }}
          className={buttonClass}
        >
          {task.status === "done" ? "Reopen" : "Mark done"}
        </button>
        <button type="button" disabled={pending} onClick={remove} className={`${buttonClass} text-danger`}>
          Delete
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
