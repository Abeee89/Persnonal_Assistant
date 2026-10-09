"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/domain/dates";
import { cn } from "@/lib/cn";
import type { HabitView } from "../service";
import { HabitCheck } from "./habit-check";

function Strip({ habit, today }: { habit: HabitView; today: string }) {
  const logged = new Set(habit.logDates);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="flex gap-1" aria-label="Last 7 days">
      {days.map((day) => (
        <span
          key={day}
          title={day}
          className={cn(
            "size-2.5 rounded-full border",
            logged.has(day) ? "border-success bg-success" : day === today ? "border-foreground/40" : "border-border",
          )}
        />
      ))}
    </div>
  );
}

export function HabitList({ habits, today }: { habits: HabitView[]; today: string }) {
  const router = useRouter();
  const refresh = () => {
    router.refresh();
  };

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {habits.map((habit) => (
        <li key={habit.id} className="flex items-center gap-4 px-4 py-3">
          <HabitCheck habitId={habit.id} date={today} initialDone={habit.doneToday} label={habit.name} onChanged={refresh} />
          <div className="min-w-0 flex-1">
            <Link href={`/habits/${habit.id}`} className="font-medium hover:underline">
              {habit.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Strip habit={habit} today={today} />
              <span className="tabular-nums">
                {habit.frequency === "daily"
                  ? `streak ${String(habit.currentStreak)}`
                  : `${String(habit.periodCount)}/${String(habit.periodTarget)} this ${habit.frequency === "weekly" ? "week" : "month"} · streak ${String(habit.currentStreak)}`}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
