"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACTIVITY_STATUSES } from "@/config/enums";
import { deleteActivityAction, duplicateActivityAction, setActivityStatusAction } from "../actions";
import type { ActivityView } from "../service";
import { localIsoDay } from "@/lib/domain/dates";

const buttonClass =
  "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60";

export function ActivityActions({ activity }: { activity: ActivityView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(task: () => Promise<{ ok: boolean; message?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      setMessage(null);
      const result = await task();
      if (!result.ok) {
        setMessage(result.message ?? "Something went wrong.");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            value={activity.status}
            disabled={pending}
            onChange={(event) => {
              const status = event.target.value as (typeof ACTIVITY_STATUSES)[number];
              run(() => setActivityStatusAction({ id: activity.id, status }));
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {ACTIVITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <Link href={`/activities/${activity.id}/edit`} className={buttonClass}>
          Edit
        </Link>
        <button
          type="button"
          disabled={pending}
          className={buttonClass}
          onClick={() => {
            run(
              () => duplicateActivityAction({ id: activity.id, date: localIsoDay() }),
              () => {
                setMessage("Duplicated to today.");
              },
            );
          }}
        >
          Duplicate to today
        </button>
        <button
          type="button"
          disabled={pending}
          className={`${buttonClass} text-danger`}
          onClick={() => {
            if (!window.confirm("Delete this activity? You can restore it from the list within this session.")) {
              return;
            }
            run(() => deleteActivityAction({ id: activity.id }), () => {
              router.push("/activities");
            });
          }}
        >
          Delete
        </button>
      </div>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
