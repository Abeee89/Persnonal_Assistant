import { cn } from "@/lib/cn";

export function HabitHeatmap({ cells }: { cells: { day: string; done: boolean }[] }) {
  const doneCount = cells.filter((c) => c.done).length;
  return (
    <section aria-labelledby="heatmap-heading" className="space-y-2">
      <h2 id="heatmap-heading" className="text-sm font-medium">
        Last year <span className="font-normal text-muted-foreground">({String(doneCount)} days done)</span>
      </h2>
      <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`${String(doneCount)} of ${String(cells.length)} days completed in the last year`}>
        {cells.map((cell) => (
          <span
            key={cell.day}
            title={`${cell.day}${cell.done ? " · done" : ""}`}
            className={cn("size-2.5 rounded-[2px]", cell.done ? "bg-success" : "bg-muted")}
          />
        ))}
      </div>
    </section>
  );
}
