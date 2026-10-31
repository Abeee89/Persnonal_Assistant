# Chunk 14 — MVP Roadmap, Development Order, Risks, What NOT to Build

> **As built:** deviations for this area are recorded in [16-implementation-notes.md](16-implementation-notes.md).

## 1. MVP definition (spec §49, adjusted)

Phase assignment vs the spec's proposal — **one deliberate change: Habits move from Phase 2 → Phase 1** (schema cost ≈ 2 tables + 200 LOC domain; daily-loop value is among the highest; the habit check on Today/dashboard is the retention engine), and **statistics ships as counters in Phase 1** (dashboard already computes them) with **charts in Phase 2**.

### Phase 1 — MVP (usable daily life-logger, ~4–6 weeks part-time)

```text
Infra: Next 15 + TS strict + Tailwind + shadcn/ui + Drizzle/SQLite + migrations + seed
Design system core (tokens, layout shell, sidebar/bottom-nav, theme 3-state)
Activities CRUD + list/filter + duplicate + tags/categories
Journal (TipTap, prompts, autosave, per-date, browse)
Tasks (lanes, quick add, statuses, links)
Goals + Milestones (+ progress, calendar deadlines)
Habits + HabitLogs (daily/weekly, checks, streaks, heatmap)
Calendar (month/week/day, entity filters) + Timeline component
Attachments (local FS, dropzone, previews, safety pipeline)
Dashboard + Today
Search (FTS5 + ⌘K + /search page)
Backup/Restore (JSON/CSV/ZIP, import w/ preview+txn)
Preferences (incl. density, week start), shortcuts (fixed set), PWA manifest (install only)
Testing: unit domain + integration actions + E2E core journey; a11y basics
```

### Phase 2 — Comfort & reach

```text
Habit extras (notes, bulk backfill polish) · Statistics charts (Recharts) + weekly/monthly reflection
PWA offline app-shell + outbox-queue offline capture · Browser local reminders
Attachment polish (filename search, storage manager) · Natural-language quick-add parser
Keyboard remapping + g-sequences · CSV/MD granular exports · Auto-backup scheduler + restore UI polish
Optional local auth (Better Auth flag, /lock, sessions UI) · Focus mode
```

### Phase 3 — Intelligence & growth

```text
AI (AIService + Ollama default, consent gates, audit log) — summaries, goal breakdown, journal assistant
Advanced analytics (correlations mood↔habits, time-of-day productivity) · Advanced search operators
Automation (templates, recurring activities, if-this journal nudges) · Personal insights digests
Multi-device sync spike (user-owned Postgres/S3 path or CRDT research) · SVG/other formats policy review
i18n (next-intl) · At-rest encryption evaluation
```

**Change vs spec:** only habits + stats-counter moves (plus manifest-not-SW pulled early because it's free). Everything else matches spec intent: PWA-offline, notifications, AI deferred; nothing from spec's Phase 3 pulled forward.

## 2. Milestone acceptance (Definition of Done per phase)

P1 DoD = E2E journey (chunk 13 §1.4 incl. restore-wipe-verify) green on desktop+mobile emulation, `verify` green, data folder portable to fresh machine with zero setup beyond `pnpm install`, a11y axe 0 critical, perf budgets met on 50k fixture.

## 3. Recommended development order (spec §54, dependency-adjusted)

Spec order works with two swaps: **design system before first feature** (it *is* the foundation of every page) and **attachments after journal** (journal is the first real file consumer) and **search after all content entities** (FTS must cover full surface when tested). Dashboard deliberately *after* entities (it composes everything) even though it's the landing page — build entity pages first, then wire `/` to read them.

```text
1  Project setup (Next/TS/Tailwind/eslint-boundaries/vitest/playwright/env-schema, CI skeleton)
2  Design system: tokens, theme(3-state), shadcn primitives, layout shell, sidebar+bottomnav,
   PageHeader/EmptyState/Skeleton/Toast conventions            → app feels real from day 1
3  Database: client+pragmas, drizzle-kit, schema (all MVP tables), migrations, seed categories,
   repository conventions + golden-query EXPLAIN harness
4  Core architecture: Result contract, error taxonomy+logger, ids, lib/domain pure fns + unit tests,
   feature-slice template (activity as the pilot slice end-to-end incl. tests)
5  Schemas (Zod catalog) + action conventions (guardedAction wrapper)
6  Activities (CRUD, list/filter/sort, tags, detail)           ← template validated here
7  Journal (TipTap integration, prompts, autosave, browse)
8  Attachments infra (StorageProvider, upload route, safety pipeline, dropzone) → wire to journal+activities
9  Tasks (lanes, quick add, toggles, links)
10 Goals + Milestones (progress modes, linking)
11 Habits + HabitLogs (checks, streaks, heatmap)
12 Calendar + Timeline (event union query, views, filters)
13 Today page + Dashboard (snapshot queries, rotating card)
14 Search (FTS tables+triggers, /api/search, ⌘K palette, /search page)
15 Preferences + shortcuts + settings pages
16 Statistics counters (domain fns + cards)   [charts P2]
17 Backup/Restore (export formats, zip pipeline, import w/ preview + auto-backup)   ← P1 finale
18 Testing hardening: E2E journey, a11y pass, perf fixture run, budget gates
19 PWA manifest polish → ship v1
── Phase 2 ── 20 SW+offline shell+outbox · 21 charts+reflections · 22 reminders · 23 NL quick-add
24 granular exports/storage mgr · 25 auth flag (Better Auth, /lock, sessions) · 26 remapping/focus mode
── Phase 3 ── 27 AIService+providers+gates · 28 advanced analytics · 29 automation · 30 sync spike/encryption/i18n
```

## 4. Technical risk register (spec §52)

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|------------|
| R1 | Database corruption / disk failure → total loss | Critical | Low | WAL + `synchronous=NORMAL`, boot `integrity_check` (fail→recovery mode), daily `VACUUM INTO` snapshots, import-verified ZIPs, restore drill in CI, user-facing backup reminders |
| R2 | Data loss during import/restore | Critical | Med | checksum-validated archive, preview diff w/ counts, auto-backup before apply, single txn + rollback, no destructive op without backup |
| R3 | Attachment storage growth (GBs) | Med | High | size caps, thumbnail strategy, storage usage dashboard, orphan sweeps, "largest files" cleanup tool, documented S3 provider seam |
| R4 | Backup failure / user never backs up | High | Med | one-click export, auto snapshot folder, staleness nudge card, restore flow tested like a feature, README 3-line backup how-to |
| R5 | Offline sync conflicts (P2) | Med | Med | scope offline to append-only outbox, server-wins + user-copy-as-draft policy, idempotency keys; no two-way merge in P2 |
| R6 | Browser storage limits/eviction | Low→Med | Med | outbox capped (≤ 500 items/2 MB) with overflow UI message; browser never holds primary data (local-server-first choice) |
| R7 | Polymorphic attachment FK drift (entity deleted → dangling) | Low | Med | service-level bind validation, nightly orphan sweep, `status` lifecycle, restore-time re-link report |
| R8 | Auth complexity creep | Med | Low | default = no auth (documented threat model); auth behind one flag w/ proven lib (Better Auth); no custom session code ever |
| R9 | AI privacy breach (journal text to cloud) | High | Low→Med | remote off by default, env+UI double gate, consent w/ payload preview, private flag, redaction, audit log, Ollama-first guidance |
| R10 | Performance with large datasets (10 yr usage) | Med | Med | indexed access patterns (partial), keyset pagination, virtualization, FTS (not LIKE), EXPLAIN CI guards, 50k/1M-row fixture tests, weekly VACUUM |
| R11 | Migration problems across versions | Med | Med | committed SQL migrations, schema_version in backups, expand→migrate→contract rule, import auto-transforms older versions, migration tests in CI |
| R12 | File upload vulnerabilities | High | Low | magic-byte sniffing, allowlists, caps, no-exec paths, sanitized served types, sandbox CSP, SVG excluded, security E2E cases |
| R13 | better-sqlite3 native-build friction (platform) | Low | Med | prebuilt binaries via pnpm, Docker linux image pinned, CI matrix includes win32-x64 + linux, documented fallback: Node 22 `node:sqlite` behind driver factory |
| R14 | Scope creep (the "OS" dream) | High | High | this §1 + chunk 15 §5 "postpone" contract; features enter only through named seams; roadmap review at each phase gate |
| R15 | TZ/locale bugs (local-date model) | Med | Med | single local-date convention (§03 §4.1), TZ env in docker, date-fns utils unit tests, no raw `Date` in domain fns |
| R16 | TipTap JSON forward-compat | Low | Low | strict allowed-node schema, version field in stored doc, deterministic plain-text extraction fallback renderer |

## 5. What NOT to build initially (spec §55)

| Excluded | Why postponed |
|----------|---------------|
| Social/sharing/collaboration | Product is a private journal-class tool; sharing inverts the trust model and multiplies auth/permissions cost |
| Multi-user/roles/permissions | One actor (assumption A1); role systems without a second user are pure speculation |
| Real-time sync/multi-device | Needs CRDT/OT layer (R5) — highest complexity item; backup/restore + PWA outbox cover 80% of the felt need |
| Microservices / separate backend | Modular monolith (chunk 05) delivers all current isolation needs; services = ops tax with zero benefit at 1 user |
| Kubernetes / queues / distributed infra | Same — absurd for local-first personal app |
| Full REST CRUD surface | Server Actions cover mutations day-1; REST shim documented when machine clients exist (chunk 07 §2) |
| Complex automation engine / advanced AI agents | Phase-3 rule-based templates + narrow AI features beat open-ended engines on value/complexity |
| Enterprise analytics (cohorts, funnels, exports to BI) | Personal stats questions are fixed-count; chart set defined in chunk 11 §3 |
| E2E encryption at rest / password vaults | Threat model = trusted personal device (A4); honest disk-encryption guidance instead; revisit when threat model changes |
| Native mobile apps / extensions | Responsive PWA covers phone; two codebases would fracture the MVP |
| i18n framework | English first (A8); seam documented, translation later |
| Stopwatch time-tracking | Start/end + duration satisfies; timer state invites "always-running" UX debt |
