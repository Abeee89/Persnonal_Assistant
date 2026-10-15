"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SHORTCUTS } from "@/config/shortcuts";
import { isEditableTarget, matchesShortcut } from "@/lib/domain/shortcuts";

interface ShortcutContextValue {
  enabled: boolean;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  register: (id: string, handler: () => void) => () => void;
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

export function ShortcutProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [handlers] = useState(() => new Map<string, () => void>());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const typing = isEditableTarget(event.target);
      for (const action of SHORTCUTS) {
        if (!matchesShortcut(event, action.combo)) {
          continue;
        }
        if (typing && !action.allowInInput) {
          return;
        }
        if (action.id === "help") {
          event.preventDefault();
          setHelpOpen((open) => !open);
          return;
        }
        const handler = handlers.get(action.id);
        if (handler) {
          event.preventDefault();
          handler();
        }
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, handlers]);

  const value = useMemo<ShortcutContextValue>(
    () => ({
      enabled,
      helpOpen,
      setHelpOpen,
      register: (id, handler) => {
        handlers.set(id, handler);
        return () => {
          if (handlers.get(id) === handler) {
            handlers.delete(id);
          }
        };
      },
    }),
    [enabled, helpOpen, handlers],
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}

export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error("useShortcuts must be used within ShortcutProvider");
  }
  return context;
}
