import Link from "next/link";
import { cn } from "@/lib/cn";
import type { SearchHit } from "../service";

export function SnippetText({ hit }: { hit: SearchHit }) {
  return (
    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
      {hit.snippet.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-sm bg-warning/30 px-0.5 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

export function SearchResults({ hits, className }: { hits: SearchHit[]; className?: string }) {
  return (
    <ul className={cn("divide-y divide-border rounded-lg border border-border bg-surface", className)}>
      {hits.map((hit) => (
        <li key={`${hit.kind}:${hit.ref}`}>
          <Link href={hit.href} className="block px-4 py-3 hover:bg-accent/50">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{hit.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{hit.kindLabel}</span>
            </div>
            <SnippetText hit={hit} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
