"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ThemeMode } from "@/lib/theme";
import { useTheme } from "./theme-provider";

const OPTIONS: readonly { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex rounded-md border border-border bg-background p-0.5",
        compact && "flex-col",
      )}
    >
      {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
        const selected = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => {
              setMode(option);
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors",
              selected && "bg-accent text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
