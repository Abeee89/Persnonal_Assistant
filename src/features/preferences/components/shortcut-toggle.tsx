"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPreferenceAction } from "../actions";

export function ShortcutToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium">Keyboard shortcuts</p>
        <p className="text-xs text-muted-foreground">{message ?? (enabled ? "On" : "Off")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await setPreferenceAction({ key: "shortcutsEnabled", value: !enabled });
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setMessage(null);
            router.refresh();
          });
        }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        <span className="sr-only">Toggle keyboard shortcuts</span>
      </button>
    </div>
  );
}
