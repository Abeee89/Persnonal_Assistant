"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetPreferenceAction, setPreferenceAction } from "../actions";
import type { Preferences } from "../service";

const selectClass =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Preset sizes up to the server cap, always including the current value so the select never shows a wrong option. */
function sizeOptions(serverMaxBytes: number, current: number): number[] {
  const presets = [1, 2, 5, 10, 25, 50].map((mb) => mb * 1024 * 1024).filter((bytes) => bytes <= serverMaxBytes);
  return presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b);
}

export function PreferenceForm({ prefs, serverMaxBytes }: { prefs: Preferences; serverMaxBytes: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save(key: string, value: unknown) {
    startTransition(async () => {
      setMessage(null);
      const result = await setPreferenceAction({ key, value });
      if (!result.ok) {
        setMessage(result.fieldErrors?.value?.[0] ?? result.message);
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  function clearName() {
    startTransition(async () => {
      const result = await resetPreferenceAction({ key: "displayName" });
      if (result.ok) {
        setMessage("Name removed.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const raw = data.get("displayName");
          const name = typeof raw === "string" ? raw.trim() : "";
          save("displayName", name);
        }}
      >
        <label className="block text-sm font-medium">
          Display name
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Shown in your dashboard greeting.</span>
          <div className="mt-1 flex gap-2">
            <input
              name="displayName"
              maxLength={60}
              defaultValue={prefs.displayName ?? ""}
              className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
              Save
            </button>
            {prefs.displayName ? (
              <button type="button" disabled={pending} onClick={clearName} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60">
                Clear
              </button>
            ) : null}
          </div>
        </label>
      </form>

      <label className="flex items-center justify-between gap-4 text-sm font-medium">
        Week starts on
        <select
          value={String(prefs.weekStart)}
          disabled={pending}
          onChange={(event) => {
            save("weekStart", Number(event.target.value));
          }}
          className={selectClass}
        >
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </select>
      </label>

      <label className="flex items-center justify-between gap-4 text-sm font-medium">
        Density
        <select
          value={prefs.density}
          disabled={pending}
          onChange={(event) => {
            save("density", event.target.value);
          }}
          className={selectClass}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>

      <label className="flex items-center justify-between gap-4 text-sm font-medium">
        <span>
          Largest attachment
          <span className="block text-xs font-normal text-muted-foreground">
            Capped at {Math.round(serverMaxBytes / 1024 / 1024)} MB by the server.
          </span>
        </span>
        <select
          value={String(Math.min(prefs.attachmentMaxBytes, serverMaxBytes))}
          disabled={pending}
          onChange={(event) => {
            save("attachmentMaxBytes", Number(event.target.value));
          }}
          className={selectClass}
        >
          {sizeOptions(serverMaxBytes, Math.min(prefs.attachmentMaxBytes, serverMaxBytes)).map((bytes) => (
            <option key={bytes} value={bytes}>
              {Math.round(bytes / 1024 / 1024)} MB
            </option>
          ))}
        </select>
      </label>

      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
