import { cn } from "@/lib/cn";

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label ?? "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${String(clamped)}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{clamped}%</span>
    </div>
  );
}
