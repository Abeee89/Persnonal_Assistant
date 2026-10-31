# Personal Activity — Software Design Document

**Version:** 1.0 · **Status:** Approved blueprint · **Date:** 2026-10-02
**Document set:** `docs/sdd/01…16` (this file is chunk 01). Assembled master: `docs/sdd/SDD.md`.

> **As built:** implementation status and every deviation from this design are recorded in
> [16-implementation-notes.md](16-implementation-notes.md). Read that alongside this blueprint.

---

## Part 1 — Executive Summary

**Personal Activity** is a private, local-first personal activity OS: one web application that combines activity tracking, daily journaling, tasks, goals with milestones, habits, calendar, timeline, statistics, search, and full export/restore — without requiring cloud services, third-party accounts, or AI.

The architecture is a **modular monolith on Next.js 15 (App Router) + TypeScript**, using **SQLite via Drizzle ORM** as the single owned data file and **local filesystem** storage for attachments behind a swappable `StorageProvider` interface. The whole product lives in one directory: delete it and nothing is lost elsewhere; copy it and everything is backed up.

Core delivery boundary (MVP / Phase 1) ships: dashboard, activities, journal, tasks, goals + milestones, habits, calendar, timeline, attachments, FTS5 search, dark mode, and ZIP backup/restore. AI, offline PWA sync, charts-rich analytics, and notifications are later, strictly additive phases.

**Guiding engineering rule:** every layer must be explainable to one developer. No microservices, no queues, no Kubernetes, no distributed sync in MVP. Complexity enters only through named, reversible seams (`StorageProvider`, `AIService`, auth upgrade path).

## Part 2 — Product Vision

> A private, local-first Personal Activity OS that combines activity tracking, journaling, tasks, goals, habits, calendar, statistics, personal reflection, and optional AI-powered insights into one clean and intuitive application.

The product answers one question for the user every day: **"where did my time go, and am I moving toward what matters?"**

Vision properties:

1. **Own your data.** A single folder holds the app, the database file, and attachments. Export is a first-class feature, not an afterthought.
2. **Useful with zero network.** The app runs from `localhost` with no external calls required for any core feature.
3. **Low-friction capture.** Recording an activity or journal line takes seconds (quick add, keyboard palette, mobile FAB).
4. **Reflection loop built in.** Daily → weekly → monthly reflection is a designed flow, not a blank text box.
5. **AI as an optional lens.** Summaries, insights, and planning help arrive through the `AIService` abstraction (local Ollama first). Turning AI off removes nothing essential.

## Part 3 — Goals and Objectives

### Product goals

| # | Goal | Success measure |
|---|------|-----------------|
| G1 | User logs ≥ 5 activities on a typical day by week 2 | Activity count per active day in local stats |
| G2 | Journal habit formed | ≥ 4 entries/week sustained over a month |
| G3 | Full history retrievable | Any record findable via search in < 200 ms p95 |
| G4 | Zero data hostage-taking | Export → wipe → import restores 100% of records |
| G5 | Daily usability on phone | Core capture flows usable one-handed < 10 s |

### Engineering objectives

| # | Objective | Constraint |
|---|-----------|------------|
| E1 | Single-binary-ish deployment | `pnpm start` or one Docker container, one volume |
| E2 | Cold dashboard render | < 1.5 s on local SSD, mid-range laptop |
| E3 | 10-year data horizon | Schema versioned; migrations reversible-forward; SQLite file at 50k activities stays fast |
| E4 | Type safety end-to-end | DB row → service → action → UI, no `any` at boundaries |
| E5 | Testable core | Pure functions for duration, streaks, progress, productivity score |

## Part 4 — Scope

### In scope (documented by this SDD)

- Personal Activity web app (desktop + mobile responsive, installable PWA in Phase 2)
- Entities: Activities, Journals, Tasks, Goals, Milestones, Habits, Habit logs, Categories, Tags, Attachments, Preferences
- Calendar, Timeline, Dashboard, Global search (FTS5), Statistics, Daily/weekly/monthly reflection
- Export/Import (JSON/CSV/ZIP), attachment storage (local FS)
- Single-user operation; optional local auth gate (Phase 2)
- Optional AI via provider abstraction (Phase 3)

### Out of scope (see § "What NOT to build", chunk 14)

- Multi-user, collaboration, sharing, social features
- Real-time sync between devices, CRDT merge engines
- Native mobile apps, browser extensions
- Enterprise permissions/roles, orgs, teams
- Time-tracking metering (stopwatch) beyond start/end duration
- E2E encryption at rest (documented as future option; threat model assumes disk-level trust)

## Part 5 — Assumptions

| # | Assumption | If wrong |
|---|-----------|----------|
| A1 | Single user, single primary device (laptop/phone of same person) | Revisit auth + sync design (documented seam in chunk 09) |
| A2 | App runs on user's own machine or private LAN (Docker/NAS/VPS behind Tailscale) | Cloud deploy requires auth module → Phase 2 becomes mandatory |
| A3 | Data volume ≤ ~50k activities, ~5k journal entries, ~50k habit-log rows over years | FTS5 + indexes sized for this; PostgreSQL migration path exists (chunk 06) |
| A4 | Disk is trusted (device not shared); OS user account is the security boundary | Enable auth gate + optional at-rest encryption (future) |
| A5 | Node.js 22 LTS available; SQLite ≥ 3.4x (FTS5, JSON1 compiled — bundled via `better-sqlite3`) | Pin dependency, no system SQLite reliance |
| A6 | User performs their own backups; app reminds and makes it easy but cannot guarantee it | Phase 2 auto-backup snapshot on each write-day |
| A7 | AI features may send *selected* text to local Ollama by default; remote providers require explicit per-feature opt-in | Privacy gates specified in chunk 12 |
| A8 | English UI first; i18n seam via `next-intl` deferred (not in MVP) | Add locale layer in Phase 3 if needed |
| A9 | Attachments ≤ 10 MB/file default cap, images + PDF priority | Raise cap via config; streaming storage unchanged |

## Requirement → SDD section map

Spec §1–58 coverage (numbers = sections of `plan_SSD.txt`):

| Spec § | Topic | Where answered |
|--------|-------|----------------|
| 1–2 | Overview, objective | This chunk: Parts 1–4 |
| 3 | Tech preference | Chunk 05 |
| 4 | Database options A–E | Chunk 06 §1 |
| 5 | File storage | Chunk 08 |
| 6 | System architecture | Chunk 05 §2 |
| 7 | Dashboard | Chunk 10 §1 |
| 8–13 | Activity, journal, goals, milestones, habits, tasks | Chunk 10 §2–§7 |
| 14–15 | Calendar, timeline | Chunk 10 §8–§9 |
| 16 | Statistics + charts eval | Chunk 11 §3 |
| 17 | Global search | Chunk 11 §1 |
| 18 | Attachments | Chunk 08 |
| 19 | Data ownership | Chunk 11 §2 |
| 20 | Privacy | Chunk 09 §3 |
| 21 | Authentication | Chunk 09 §1 |
| 22–28 | UI/UX, nav, design system, dark mode, shortcuts, quick add | Chunk 04 |
| 29 | State management | Chunk 05 §5 |
| 30 | Validation | Chunk 05 §6 |
| 31 | Performance | Chunk 05 §7 |
| 32–33 | PWA + offline-first | Chunk 12 §1–§2 |
| 34 | AI integration | Chunk 12 §3 |
| 35 | Notifications | Chunk 12 §4 |
| 36 | Accessibility | Chunk 04 §8 |
| 37 | Security | Chunk 09 §4 |
| 38 | Database design | Chunk 06 |
| 39 | API architecture | Chunk 07 |
| 40 | Folder structure | Chunk 05 §4 |
| 41–43 | Env, dev env, deployment | Chunk 13 §4, chunk 05 §8, chunk 09 §5 |
| 44–46 | Testing, error handling, logging | Chunk 13 §1–§3, chunk 12 §5 |
| 47 | User flows | Chunk 03 |
| 48 | Pages | Chunk 10 (per feature) + chunk 03 §IA |
| 49 | MVP definition | Chunk 14 §1 |
| 50 | Decision matrix | Chunk 05 §3 |
| 51 | Constraints | Chunk 05 §1 |
| 52 | Risks | Chunk 14 §4 |
| 53 | Acceptance criteria | Chunk 10 (per feature) |
| 54 | Development order | Chunk 14 §3 |
| 55 | What not to build | Chunk 14 §5 |
| 56–57 | SDD structure, final recommendation | Full set + chunk 15 |
