# Chunk 16 — Implementation Notes (As Built)

**Purpose.** Chunks 01–15 remain the design blueprint. This chunk records what was
actually built, where it deviates, and why — so the document stays trustworthy as the
implementation reference. Every "deferred" item below is deliberate, not forgotten.

**Status:** roadmap steps 1–18 complete. Local-first app runs; no cloud services required.

**Verification gate used throughout**

```bash
npm run verify     # typecheck + lint + vitest
npm run build      # production build
npm run test:e2e   # Playwright: 12 journey tests + 9 axe accessibility checks
```

At the time of writing: **36 Vitest files** and **21 Playwright tests** pass; typecheck,
lint and build are clean.

---

## 1. As-built stack (deltas from chunk 05 §3)

| Area | Designed | As built | Reason |
|------|----------|----------|--------|
| Package manager | pnpm | **npm + package-lock.json** | pnpm was not installed in the environment; npm is functionally equivalent here |
| Runtime | Node 22 LTS | **Node 24.13** (engines `>=22.12`) | Installed LTS line; Next 15 needs ≥18.18 |
| Data fetching | RSC + TanStack Query islands | **RSC + Server Actions + URL cursor paging** (no TanStack Query) | Local loopback latency makes a client cache unnecessary |
| Global client state | Zustand for upload queue | **React Context for shortcuts/prefs + local state** | One small store did not justify the dependency |
| Revalidation | `revalidateTag` | **`revalidatePath`** | Simpler with no tag registry; paths cover the affected views |
| Thumbnails | `sharp` | **not installed** | Avoids a native dependency; images render with `loading="lazy"` |
| Charts | Recharts (Phase 2) | **not installed** | Charts remain Phase 2; statistics ship counters + CSS bars |
| Zip | fflate | **fflate** ✅ | As designed |
| PWA | @serwist (Phase 2) | **not started** | Deferred; see §3.9 |
| E2E | Playwright | **Playwright, system Chrome channel** | Avoids a browser download; CI would run `playwright install` |
| UI primitives | shadcn/ui (Radix) | **Hand-rolled Tailwind primitives**; native `<dialog>`, `<select>` | Fewer dependencies; the axe pass covers serious/critical findings |
| Toasts / sheets | sonner, vaul/Radix sheets | **Inline `role="status"` / `role="alert"` messages**; fixed mobile nav (no bottom sheet) | Avoided three dependencies for patterns the app rarely needs |
| Fonts | Inter via `next/font` (self-hosted) | Inter named first in `--font-sans`, **falls back to the system sans stack** (not self-hosted) | No font download/build step; add `next/font` if exact typography matters |

Final dependency set (runtime): `next`, `react`, `react-dom`, `zod`, `drizzle-orm`,
`better-sqlite3`, `pino`, `lucide-react`, `clsx`, `tailwind-merge`, `fflate`,
`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`.
Dev: `typescript`, `eslint`, `typescript-eslint`, `eslint-config-next`, `tailwindcss`,
`@tailwindcss/postcss`, `postcss`, `vitest`, `drizzle-kit`, `@playwright/test`,
`@axe-core/playwright`, `@types/better-sqlite3`, `@types/node`, `@types/react`,
`@types/react-dom`, `@eslint/js`.

---

## 2. Project structure (deltas from chunk 05 §4)

Actual layout adds a few modules and collapses some:

- `src/config/enums.ts` — shared enums (used by DB checks and Zod schemas).
- `src/config/shortcuts.ts` — shortcut registry (must be importable by server pages).
- `src/config/env.ts` — fail-fast env validation.
- `src/tests/journey.test.ts` — cross-feature service-level journey.
- `e2e/` — Playwright specs (`journey.spec.ts`, `a11y.spec.ts`).
- `src/hooks/` — **not created** (no shared hooks needed yet).

Only **activities** has a dedicated `repository.ts`. Journal, tasks, goals, habits,
statistics and backup keep their Drizzle queries inside `service.ts`. The important rule
still holds: SQL lives in the feature slice, never in components or actions.

---

## 3. Deviations by design chunk

### 3.1 Routing and pages (chunks 03, 10, 48)

| Designed | As built |
|----------|----------|
| Create/edit via `@modal` parallel slot | **Dedicated routes**: `/activities/new`, `/activities/[id]/edit`, `/goals/new`, `/goals/[id]/edit`, `/habits/new`, `/habits/[id]/edit` |
| `/journal/[date]` canonical, `/journal/[id]` alias | Only `/journal/[date]` exists |
| `/settings`, `/settings/backup`, `/settings/preferences` | Also `/settings/shortcuts` and `/settings/data` |
| `/lock` lock screen (Phase 2) | Not built (no auth) |
| `/today` dense day sheet with gap hints | **Day-scoped dashboard** with prev/next; gap hints live on the calendar day view |

### 3.2 Database (chunk 06)

- All 16 MVP tables + `meta` exist as specified, plus the FTS index.
- **`users` and `sessions` were not created**, although chunk 09 said to ship them from day
  one for backup stability. Auth is off, so they are absent; enabling auth later is an
  additive migration and the backup format tolerates missing tables.
- **`meta.schema_version` is not maintained.** The schema version is a code constant
  (`SCHEMA_VERSION = 1`) written into backups.
- `search_fts` (FTS5) arrives in `drizzle/0001_search_fts.sql` with triggers for the five
  entities and four tag junctions, plus a backfill of existing rows.
- Category `ON DELETE` is **`restrict`** (an early draft used `set null`; corrected and the
  migration regenerated).
- `duration_minutes` and `start_epoch` are stored snapshots/order keys, as designed.
- Soft delete applies to activities, journals and goals only.
- No `DailySummary` table (deferred in the design as well).

### 3.3 HTTP surface (chunk 07)

Implemented:

| Route | Purpose |
|-------|---------|
| `POST /api/attachments` | multipart upload with magic-byte validation |
| `GET /api/files/[id]` | stream a `ready` attachment (`nosniff` + sandbox CSP) |
| `GET /api/export?format=json\|csv\|zip` | stream a backup |
| `POST /api/import` (`?preview=1`) | validate/preview or apply a backup |
| `GET /api/search` | FTS results for the command palette |

Not implemented (all were optional in the design): `/api/files/[id]/thumb`,
`DELETE /api/attachments/:id` (deletion is a server action), `/api/events`, `/api/health`,
`/api/ai/*`.

Two Next.js constraints discovered and applied:

1. A `"use server"` module may only export real `async function`s. `defineAction` produces
   a handler; each action therefore wraps it in an exported `async function`.
2. A route file may only export its handlers and config. Constants such as
   `MAX_IMPORT_BYTES` are module-local.

### 3.4 Attachments (chunk 08)

- Providers: `LocalFsStorage` and `MemoryStorage`. **No S3 stub** was written.
- **No thumbnails, no EXIF rotation, no downscale** (`sharp` not installed). The UI shows
  the original image.
- Allowed by sniffed magic bytes: JPEG, PNG, WEBP, PDF. SVG stays excluded.
- Lifecycle: activity uploads bind immediately; journal uploads land `pending` and bind
  inside the journal save transaction.
- `sweepPending` exists and is tested, but **nothing schedules it** (no cron/boot hook yet).
- Serving only happens for `ready` rows; pending files are not publicly reachable.

### 3.5 Auth and security (chunk 09)

- Local-only, **no authentication**, no user/session tables — the documented MVP choice.
  The `guard` seam in `defineAction` is wired but permissive.
- Security headers set in `next.config.ts`: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- **No global Content-Security-Policy header.** The sandbox CSP applies to file responses.
  A site-wide CSP is a follow-up (see §5).
- `assertSameOrigin` guards state-changing POST routes.
- Structured logs via pino with content redaction; **stdout only** (no `data/logs` rotation).
- No dependency audit or CI pipeline.

### 3.6 Features (chunk 10) — per module

| Module | Built | Notable gaps vs. design |
|--------|-------|------------------------|
| Dashboard | Greeting (uses `displayName`), 4 stat cards, CTA row, today timeline (activities + tasks), focus card, recent journal, habit list | Focus card and recent-journal panel can both show, so it is not strictly "one rotating card" |
| Today | Day-scoped dashboard with prev/next | Not the separate dense sheet with gap hints |
| Activities | CRUD, filters, sort, search, duplicate-to-day, soft delete, restore (action only), tags, mood/energy/location, attachments | No bulk select; **no goal picker** (`goalId` always null); restore has no UI; no convert-to-task |
| Journal | TipTap, 7 prompts, mood, private flag, 1.5 s autosave + flush on hide, attachments, month list, day nav | **No energy picker** (field always null); **no finalize button** (action exists); no tag input; no Markdown export |
| Tasks | Lanes, quick add (title + due), complete/reopen, detail page, goal/activity link display | **No edit form** (title/description/due/priority/links); no reorder; no subtasks; no natural-language parsing |
| Goals | Create/edit, milestones add/toggle/delete, auto/manual progress, status sync, archive, linked tasks/activities, soft delete | No milestone reorder; no goal pickers on task/activity forms |
| Habits | Daily/weekly/monthly + target, streaks, completion rate, 7-day strip, 365-cell heatmap, today check | **Heatmap is not clickable** (no backfill UI); **no archive UI** (action exists); no reminders |
| Calendar | Month grid (6 weeks), week column list, day timeline with gap callouts + prefill link, entity filters | **Week is a list, not an hourly time grid**; no drag-to-create; no peek popover |
| Statistics | Day/week/month tabs, 7 stat cards, category-mix bars, mood chips | **No charts** (Phase 2); productive categories are a **fixed list** |
| Search | One `search_fts` table, triggers, bm25, prefix, palette, `/search` | Journal indexes `content_plain` + tags + date, **not prompt fields**; no attachment-filename search |
| Settings | Preferences (name, week start, density, shortcuts on/off, attachment cap), shortcuts list, data usage, backup | **Theme is browser-only** (not a DB preference); **no shortcut remapping**; data page is read-only |

### 3.7 Backup and restore (chunk 11)

Archive matches the design: `data.json`, `metadata.json`, `schema-version.json`,
`manifest.sha256.json`, `attachments/…`.

| Designed | As built |
|----------|----------|
| Merge-by-id upsert | **Merge = `INSERT OR IGNORE`** (keeps existing rows, adds only new; no overwrite) |
| Replace inside one transaction | ✅ delete (children first) → insert, one transaction |
| Preview before apply | ✅ `?preview=1` + UI diff table |
| Pre-import auto-backup | ✅ `VACUUM INTO` → `data/backups/auto/pre-import-<ts>.db`, listed on the page |
| Encrypted ZIP (Phase 2) | Not built |
| Scheduled exports + staleness reminder | Not built |
| Single-entry Markdown export | Not built |
| Validation | ✅ version refusal, checksum manifest, entry allowlist (zip-slip), PRAGMA-derived columns |

### 3.8 Search and statistics specifics (chunk 11)

- **One shared FTS5 table** (`kind`, `ref`, `title`, `body`, `tags`) instead of four
  per-entity tables. One MATCH covers every type; triggers maintain it.
- `snippet(search_fts, -1, …)` lets SQLite pick the best column; the UI splits highlight
  markers into text segments (no `dangerouslySetInnerHTML`).
- Search input is tokenised and quoted, so FTS operators are treated as words; the last
  token gets a prefix match.
- The FTS query is built as a literal string (identifiers allow-listed, match quoted and
  escaped) rather than bound parameters; covered by an escaping/injection test.
- Statistics: `PRODUCTIVE_CATEGORY_SLUGS = ["work","study","project","exercise","health"]`.
- Weekly/monthly habit expectations count whole periods, so a partial window can slightly
  over-count.

### 3.9 PWA, offline, AI, notifications, logging (chunk 12)

- **No web app manifest, no service worker, no offline outbox.** The manifest was listed as
  a "trivial Phase 1" item and was not delivered; it should be added before Phase 2 work.
- **No AI integration** (Phase 3).
- **No notifications** (Phase 2).
- Logging: pino to stdout with redaction; no file sink/rotation and no security-event list.

### 3.10 Quality, environment, tooling (chunk 13)

- Tests: 36 Vitest files (domain, schemas, DB, per-feature integration, journey, query-plan)
  and 21 Playwright tests (12 journey, 9 axe). **No Testing Library component tests**, no
  coverage threshold, no CI.
- Performance: a **query-plan guard** over a 1,000-row fixture asserts the hot queries use
  their indexes; there is **no 50k-row load test** and no bundle-budget assertion.
- Env keys implemented: `DATA_DIR`, `PORT`, `HOSTNAME`, `LOG_LEVEL`,
  `ATTACHMENT_MAX_BYTES`, `ATTACHMENT_BACKEND` (`local` \| `memory`), `AUTH_ENABLED`,
  `AUTH_SECRET` (required only when auth is on), `AI_ENABLED`, `AI_ALLOW_REMOTE`.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `verify`.
- Node 24 in development; `engines >= 22.12`; npm with `package-lock.json`.

### 3.11 Roadmap status (chunk 14)

Steps 1–18 complete. As planned in the design's adjusted phases, habits shipped in Phase 1
and statistics shipped as counters (charts deferred).

---

## 4. Behavioural notes worth knowing

- **Journal autosave** debounces 1.5 s and flushes on `pagehide`/hidden; the save state is a
  `role="status"` region ("Unsaved changes" → "Saving…" → "Saved"). Its wording is
  case-insensitively similar to "Saved", which tripped an E2E assertion until it matched
  exactly — worth keeping in mind for future predictions.
- **Controlled checkboxes** (task, milestone) reflect server state, so a browser test must
  click and then assert the refreshed UI, not rely on the checkbox flipping instantly.
- **E2E needs a production build** and the system Chrome; a stale `.next` (missing
  `BUILD_ID`) makes `next start` refuse to boot.
- **Accessibility**: filter toggles use `aria-current` + screen-reader state text (not
  `aria-pressed` on links); calendar day links lead with the visible day number.

---

## 5. Known gaps and suggested next actions (priority order)

1. Task edit form, plus goal/activity pickers on task and activity forms (closes the
   linking the design expects).
2. Habit archive UI and heatmap backfill; journal energy picker, finalize button, tag
   input, single-entry Markdown export.
3. Web app manifest (cheap), then service worker + offline outbox.
4. Attachment thumbnails + EXIF handling (`sharp`), and scheduling `sweepPending`.
5. Statistics charts (Recharts) and a user-configurable productive-category list.
6. Calendar week time-grid and drag-to-create.
7. Backup: encrypted archives, scheduled-export reminder, true upsert merge with conflict
   report.
8. Auth (Better-Auth) + `users`/`sessions` tables when the app is exposed beyond localhost.
9. Global CSP header; CI with dependency audit, coverage gate, and a 50k-row perf run.
10. Visual-regression snapshots and cross-browser (WebKit/Firefox) E2E.

---

## 6. File inventory (as built)

```text
src/
  app/                     routes: dashboard, today, activities, journal, tasks, goals,
                           habits, calendar, statistics, search, settings/*
    api/                   attachments, files/[id], export, import, search
  components/
    layout/                app-shell, theme-provider, theme-toggle, shortcut-provider, shortcut-help
    shared/                page-header, empty-state, stat-card
  config/                  env, enums, nav, shortcuts
  db/                      schema, client, migrate, runtime, seed, fts migration, tests
  features/
    activities/            repository, service, actions, queries, components, tests
    attachments/           service, runtime, actions, queries, components, tests
    backup/                service, components, tests
    calendar/              service, queries, url-state, components, tests
    dashboard/             service, queries, components, tests
    goals/ habits/ journal/ preferences/ search/ statistics/ tasks/
                           each: service, actions, queries as needed, components, tests
  lib/
    domain/                dates, duration, goal-progress, goal-status, habit-streak,
                           habit-stats, task-lanes, timeline, calendar, stats-window,
                           focus, productivity-score, tiptap-text, fts, shortcuts, backup
    files/                 magic, keys, names
    storage/               types, local-fs, memory
    action.ts cn.ts errors.ts http.ts ids.ts logger.ts theme.ts
  schemas/                 activity, task, goal, habit, journal, preference, attachment,
                           search, backup, common
  tests/                   journey.test.ts
  types/                   result.ts
e2e/                       journey.spec.ts, a11y.spec.ts
drizzle/                   0000_init.sql, 0001_search_fts.sql, meta/
```

---

## 7. How to use the document now

1. Chunks 01–15 explain **intent** and the reasoning behind each choice.
2. This chunk explains **what exists** and where reality differs.
3. When implementing a gap from §5, update the owning chunk *and* this one in the same
   change, so the blueprint does not drift from the code.