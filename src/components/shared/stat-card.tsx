import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  href,
  children,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </>
  );
  const classes = cn("block rounded-lg border border-border bg-surface p-4", href && "hover:bg-accent/40", className);
  return href ? (
    <a href={href} className={classes}>
      {body}
    </a>
  ) : (
    <div className={classes}>{body}</div>
  );
}
