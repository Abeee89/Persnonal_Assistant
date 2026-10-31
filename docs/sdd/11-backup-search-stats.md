# Chunk 11 — Backup/Restore, Search Architecture, Statistics Architecture

> **As built:** deviations for this area are recorded in [16-implementation-notes.md](16-implementation-notes.md).

## 1. Global search (spec §17)

### 1.1 Database capability

SQLite ships **FTS5** (external-content tables). Chosen over LIKE/`instr` scans (no index → O(n) table walk, dies with years of journals) and over adding a search sidecar (violates one-file ownership).

### 1.2 Design

```sql
CREATE VIRTUAL TABLE activities_fts USING fts5(
  title, description, tags,          -- tags denormalized into searchable text
  content='activities', content_rowid='rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);
-- same pattern: journals_fts(title? none — date + content_plain + prompt fields),
--   tasks_fts(title, description, tags), goals_fts(title, description, tags)
```

Write path: **AFTER INSERT/UPDATE/DELETE triggers** on base tables keep FTS in sync inside the same txn (external-content with `insert/delete` 'rebuild'-safe pattern). Journal indexing stores `content_plain` (deterministic strip of TipTap JSON — HTML/tags never pollute). Tags joined from junction at write time into the `tags` column so tag hits surface entities.

Query path (service `search.ts`):

```sql
SELECT a.id, a.date, a.title, snippet(activities_fts, 1, '<b>','</b>',' … ', 12) AS snip,
       bm25(activities_fts, 4.0, 1.0, 2.0) AS score
FROM activities_fts JOIN activities a ON a.rowid = activities_fts.rowid
WHERE activities_fts MATCH ? AND a.deleted_at IS NULL
ORDER BY score LIMIT ?;
```

`MATCH` input sanitized (strip `"*` operator injection unless advanced mode) — user query wrapped as phrase-or-prefix. Union across 4 tables with per-type limits + recency tiebreak; `types` and date-range filters applied via join WHERE.

### 1.3 Surfaces

`⌘K` palette (`GET /api/search`, debounced 200 ms, top 10/type) and `/search?q=` full page (grouped, facet chips by type/date, keyboard-first). Result row = type icon + title + snippet + date → click routes to entity (journal by date, activity id…). Attachment *filename* search = plain LIKE over `attachments.original_name` (low volume), Phase 2. Maintenance: `PRAGMA … ; INSERT INTO x_fts(x_fts) VALUES('optimize')` on the weekly job; `'rebuild'` exposed as `pnpm db:reindex` + settings action.

**Scale guard:** FTS content stays inside db → backup covers search automatically; no separate index to drift. If corpus ever outgrows FTS5 (millions of journal words), documented fallback = split index table + trigrams — not planned.

## 2. Backup & restore (spec §19)

### 2.1 Formats

| Format | Content | Use |
|--------|---------|-----|
| `data.json` | full canonical dump (below) | restore, programmatic ownership |
| `export.csv.zip` | one CSV per table + attachments CSV | spreadsheets, audit |
| `export.zip` | the recommended full backup (below) | human backup |
| journal `.md` | single entry/front-matter Markdown | quick share-to-self |

### 2.2 Archive contract

```text
personal-activity-2026-10-02.zip
├── data.json           # all rows, entities arrayed
├── metadata.json       # exportedAt, appVersion, schemaVersion, counts, attachmentTotalBytes,
│                       #   exportFormat, hostTz, options{excludePrivate}
├── schema-version.json # {version, tableHashes?, migrationsApplied[]} — independent for safety
├── manifest.sha256.json# path → checksum for every entry incl attachments/
└── attachments/…       # files copied verbatim (relative to DATA_DIR)
```

`data.json` shape = table → array of rows, column names as-is (snake_case), `null`s explicit, dates as stored ISO/local. *Deterministic*: rows ordered by PK so two exports of unchanged data are byte-identical (except timestamps in metadata) — enables diffing backups.

### 2.3 Import (restore)

Preconditions: file is zip, contains the 3 control files, `schema-version.json` version ≤ current app version (unknown-newer refused with "update the app"), manifest checksums verified (any mismatch aborts), Zod validates every row against `schemas/backup.ts`. Steps: (1) parse+validate into memory (streamed; size guard) → (2) **preview diff report** — counts per table vs current, conflicts listed, user picks strategy: **merge-by-id (default)** / replace-all / skip-existing → (3) auto-backup current DB+attachments to `data/backups/auto/pre-import-<ts>.zip` → (4) single txn: (replace: wipe rows, delete unlisted attachment files after; merge: upsert each row, re-bind attachment paths) copy attachment files first (write-only, never overwrite different-content same-path) → (5) FTS rebuild → (6) verify counts sample → commit; on error → rollback + point user at auto-backup. Orphan attachment files on disk vs DB reported (offer clean). Foreign-key order respected (goals before milestones, etc.). Import tested in CI with a golden fixture + property checks (export∘import = identity modulo metadata).

### 2.4 Automation

Settings → Backup: manual export button (streamed download) + "Backup folder" mode (writes to `data/backups/manual/`) + reminder card when `max(export, lastAuto) > N days` (default 7) w/ snooze; auto *safety* snapshots (db only via `VACUUM INTO`) daily on boot-if-stale — cheap, never includes attachments by default. No cloud sync (out of scope) but the folder design means users can point Syncthing/Dropbox/iCloud at `data/` — documented with a warning to sync when app is idle (or use `VACUUM INTO` snapshot instead).

## 3. Statistics architecture (spec §16)

### 3.1 Chart library choice

| | Recharts | Chart.js (react-chartjs-2) | visx |
|---|---|---|---|
| React model | declarative composition ✅ | imperative canvas wrapper | DIY (highest effort) |
| Theme integration | SVG → CSS vars/tokens, dark-mode = props | canvas needs JS color re-theming | full DIY |
| SSR/hydration | safe (client islands) | canvas, needs refs | safe |
| A11y | SVG DOM → can attach tables/patterns | canvas → manual aria | DIY |
| Bundle | med (d3 tree-shaken by version) | med | small but + own layers |
| Fit: bar/line/donut/heatmap-ish grids needed | ✅ | ✅ but fighting canvas theming | overkill control |

**Choice: Recharts** — declarative SVG composes with our token system, dark-mode and contrast handled as styling, per-chart `sr-only` data table is straightforward (canvas can't). Chart.js would be the right pick for a canvas-heavy enterprise dashboard; not this.

### 3.2 Computation

All aggregates in repository SQL (bucketed server-side) + pure `lib/domain` functions — never raw in components. Precomputed on read for personal scale (indexed scans over ≤ days×entities rows); `DailySummary` materialization *considered and rejected* for MVP (extra staleness surface, no measurable need at target volume — revisit if `EXPLAIN` shows > 50 ms). Metrics:

| Metric | Definition (documented so UI+tests agree) |
|--------|-------------------------------------------|
| Productive time | Σ duration of `done`/`in_progress` activities where category ≠ (Rest/Other); configurable category list "productive" in prefs |
| Activity count / day | non-deleted rows on date |
| Task completion rate | done-within-window ÷ (due-or-created-in-window non-cancelled) |
| Habit consistency | hit-periods ÷ elapsed-since-creation periods (freq aware), 0–100 |
| Mood trend | avg mood/day of journals (null skipped), line over window |
| Journal frequency | entries ÷ window days, streak = consecutive days |
| Goal progress avg | active goals, mean progress per §10.6 formula |
| Productivity score | §06 §6 weighted formula (documented, shown in tooltip) |

### 3.3 Buckets: day→24h, week→Mon..Sun respecting `week_start`, month→days, quarter/year→weeks; line chart X always ISO dates (no locale parse).

### 3.4 AC:
- Given week with 20 h Work, 5 h Exercise, donut shows correct shares, tooltip hours match sum; changing theme re-colors without refetch.
- Given no data in period, chart area shows empty state card, never NaN axes.
- Given SR user, table toggle exposes same numbers.
- Property test: score ∈ [0,100]; consistency with 0 elapsed → 0; empty period → all zeros (no divide-by-zero).

## 4. Page-state conventions (all features, spec §45 UI states)

Loading: `loading.tsx` skeletons shaped like real content (no spinners > 200 ms) · Empty: designed EmptyState + one CTA · Error: `error.tsx` per segment "Something didn't load — [Retry] [Report: id <code>]" with `reset()` · Success: toast (sonner) with optional Undo · Offline (P2): banner + capture into IndexedDB outbox queue (chunk 12 §2) · Draft/unsaved: save-state indicator idle/saving/saved/failed(retry).
