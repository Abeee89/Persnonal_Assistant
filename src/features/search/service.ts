import { sql } from "drizzle-orm";
import type { DbExec } from "@/db/client";
import { buildMatchQuery, splitSnippet, type SnippetSegment } from "@/lib/domain/fts";

export const SEARCH_KINDS = ["activity", "task", "goal", "journal", "habit"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchHit {
  kind: SearchKind;
  kindLabel: string;
  ref: string;
  title: string;
  snippet: SegmentList;
  href: string;
  score: number;
}

export type SegmentList = SnippetSegment[];

/** Single-quoted SQL string literal. Kinds are an allow-list and the match is quoted, so this is only escaping. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export interface SearchOptions {
  kinds?: readonly SearchKind[];
  limitPerKind?: number;
}

const LABEL: Record<SearchKind, string> = {
  activity: "Activity",
  task: "Task",
  goal: "Goal",
  journal: "Journal",
  habit: "Habit",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function hrefFor(kind: SearchKind, ref: string, title: string): string {
  switch (kind) {
    case "activity":
      return `/activities/${ref}`;
    case "task":
      return `/tasks/${ref}`;
    case "goal":
      return `/goals/${ref}`;
    case "journal":
      return DAY.test(title) ? `/journal/${title}` : "/journal";
    case "habit":
      return `/habits/${ref}`;
  }
}

interface RawRow {
  kind: string;
  ref: string;
  title: string;
  snip: string;
  score: number;
}

/**
 * Full-text search across every searchable kind (SDD §11 §1). Results are ordered by
 * bm25 relevance (lower is better), with a per-kind cap so one large kind cannot
 * crowd out the others. The MATCH expression is built from quoted tokens only.
 */
export function search(db: DbExec, input: string, options: SearchOptions = {}): SearchHit[] {
  const match = buildMatchQuery(input);
  if (match === null) {
    return [];
  }
  const kinds = options.kinds && options.kinds.length > 0 ? [...options.kinds] : [...SEARCH_KINDS];
  const perKind = Math.min(Math.max(options.limitPerKind ?? 10, 1), 50);

  const rows = db.all<RawRow>(
    // Column 0 is kind, 1 is ref, 2 title, 3 body, 4 tags. Title and body carry the weight.
    sql.raw(`SELECT kind, ref, title,
            snippet(search_fts, -1, '<', '>', ' … ', 12) AS snip,
            bm25(search_fts, 0.0, 0.0, 4.0, 1.0, 2.0) AS score
       FROM search_fts
      WHERE search_fts MATCH ${sqlString(match)} AND kind IN (${kinds.map(sqlString).join(", ")})
      ORDER BY score
      LIMIT ${String(perKind * kinds.length)}`),
  );

  const counts = new Map<string, number>();
  const hits: SearchHit[] = [];
  for (const row of rows) {
    const used = counts.get(row.kind) ?? 0;
    if (used >= perKind) {
      continue;
    }
    counts.set(row.kind, used + 1);
    const kind = row.kind as SearchKind;
    hits.push({
      kind,
      ref: row.ref,
      kindLabel: LABEL[kind],
      title: kind === "journal" ? `Journal · ${row.title}` : row.title,
      snippet: splitSnippet(row.snip),
      href: hrefFor(kind, row.ref, row.title),
      score: row.score,
    });
  }
  return hits;
}
