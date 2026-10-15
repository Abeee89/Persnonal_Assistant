"use client";

import { useEffect, useRef } from "react";
import { SHORTCUTS } from "@/config/shortcuts";
import { useShortcuts } from "./shortcut-provider";

function comboLabel(combo: string): string {
  return combo
    .split("+")
    .map((part) => (part === "Mod" ? "Ctrl/⌘" : part))
    .join(" + ");
}

export function ShortcutHelp() {
  const { helpOpen, setHelpOpen, enabled } = useShortcuts();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    if (helpOpen && !node.open) {
      node.showModal();
    }
    if (!helpOpen && node.open) {
      node.close();
    }
  }, [helpOpen]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="shortcut-help-title"
      onClose={() => {
        setHelpOpen(false);
      }}
      className="m-auto w-[min(420px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="space-y-4 p-5">
        <h2 id="shortcut-help-title" className="text-base font-medium">
          Keyboard shortcuts
        </h2>
        {enabled ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map((action) => (
              <div key={action.id} className="contents">
                <dt>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">{comboLabel(action.combo)}</kbd>
                </dt>
                <dd className="text-muted-foreground">{action.label}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Shortcuts are turned off. You can turn them on in Settings → Shortcuts.
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setHelpOpen(false);
            }}
            className="h-8 rounded-md border border-border px-3 text-sm hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
