# Chunk 13 — Testing, Error Handling, Environment, Development Environment

> **As built:** deviations for this area are recorded in [16-implementation-notes.md](16-implementation-notes.md).

## 1. Testing strategy (spec §44)

### 1.1 Layers

| Layer | Tools | Scope | Target |
|-------|-------|-------|--------|
| Unit | **Vitest** (node env, fast; jsdom only for component tests) + Testing Library | pure `lib/domain` fns, schemas, mappers, hooks | ≥ 90% of `lib/domain`; ≥ 80% overall services |
| Integration | Vitest + **real SQLite temp file** (migrations run once per suite via `:memory:` where possible, file DB for WAL/FTS specifics) | repositories, services, actions, FTS, attachments w/ `MemoryStorageProvider`, backup round-trip | every action + every golden query |
| Contract | Vitest suites | backup export∘import identity; Zod schema ↔ Drizzle shape parity; `Result` codes | CI required |
| Component | Testing Library + Playwright component (optional) | forms validation states, timeline layout, palette keyboard nav, theme tokens | key composites |
| E2E | **Playwright** (chromium + webkit emulation, mobile viewport projects) | journeys below, a11y via `@axe-core/playwright`, visual snapshots (theme matrix) | 8 flows |
| Perf guards | custom test | `EXPLAIN QUERY PLAN` on 8 golden queries; `next build` budget check; 50k-row seeded db smoke | block on plan regression |

Why Vitest not Jest: ESM/TS-first with no transform config, shares `tsconfig` paths, watch speed matters for single dev + agents; Jest offers nothing this stack needs extra.

### 1.2 Unit test exemplars (spec-named functions)

```text
calculateDuration(start,end)      → minutes; null when missing; end<start impossible post-validation but guarded
calculateGoalProgress(mode,ms)    → auto ratio, round, empty=0; manual passthrough; 100 cap
calculateHabitStreak(habit,logs)  → daily/weekly/monthly calendars; grace-yesterday; broken→best fallback
calculateProductivityScore(day)   → weighted 0–100; all-zero day = 0; bounds property test
extractPlainFromTipTap(json)      → deterministic text, entity-safe
sanitizeStoragePath / assertWithinDataDir → traversal cases
checksumZip / parseManifest       → tamper cases
```

### 1.3 Integration flows (spec list)

createActivity→appears-in-lists+FTS; createJournal autosave upsert by date (no dup on race); uploadAttachment(polyglot fixture)→bind→serve headers; createGoal+milestone toggle→progress; completeTask→counters; toggleHabit today+backfill→streak; generateStatistics week buckets; exportZip byte-determinism; importZip merge vs replace; **restore-golden-fixture** (v1 archive into fresh app).

### 1.4 E2E journey (spec §44 exact, expanded)

```text
Open dashboard (fresh db) → onboarding wizard → create activity (⌘N) → write journal (⌘J, autosave)
→ upload photo to entry → create goal → add 2 milestones → create task linked to goal
→ complete task → check habit → verify calendar shows activity+goal deadline
→ search finds all four entities → statistics counters reflect day → export ZIP downloads
→ wipe db via delete-everything (typed confirm, skip auto-backup) → restore ZIP → verify all data present
```
Plus: theme toggle matrix screenshots; mobile project: FAB add + bottom nav + habit check; keyboard-only pass (palette, list nav, dialog focus trap); reduced-motion run.

### 1.5 Fixtures & CI

`tests/factories/*` builders per entity (seed helpers reuse `db/seed.ts`); 50k-activity perf fixture generated (not committed); CI (GitHub Actions self-hosted-friendly): typecheck → lint (boundaries+a11y) → unit → integration → build+budget → E2E (chromium) → nightly: webkit+a11y+perf-fixture. Coverage + artifacts (playwright traces) uploaded.

## 2. Error handling (spec §45)

### 2.1 Error taxonomy → envelope → UI

| Code class | Examples | Route handler | Action return | UI |
|------------|----------|---------------|---------------|----|
| VALIDATION | field errors | 422 `{code:"VALIDATION", fieldErrors}` | `ok:false` w/ fieldErrors | inline form errors |
| NOT_FOUND | bad id | 404 | `ok:false NOT_FOUND` | toast + list refresh |
| CONFLICT | journal dup after race, stale edit (`updated_at` mismatch) | 409 | 409 w/ current row | "changed elsewhere — merge?" dialog |
| FORBIDDEN | auth off-mode only | 401/403 | — | → /lock (P2) |
| FILE_* | TOO_LARGE 413, UNSUPPORTED 415, BIND_INVALID 400 | as shown | ok:false STORAGE | dropzone message |
| STORAGE | disk full, write fail | 507/500 | ok:false STORAGE | retry + settings hint |
| DB | constraint, busy timeout | 500 | ok:false DB | generic + requestId |
| UNKNOWN | anything escaping | 500 redacted | ok:false UNKNOWN | generic + requestId |

Rules: `errors.ts` defines class hierarchy w/ `code`; middleware/error boundary maps → envelope; **production responses contain message+requestId only** (stack server log, spec §37); dev mode adds `stack` + `sql`? never (even dev: sql in terminal log only). All UI mutations handle `ok:false` (typed union forces it). `global-error.tsx`: "App crashed — reload; data up to last autosave is safe" (never dead white page). `not-found.tsx`: search box + nav. Route segments own `error.tsx` so a broken calendar doesn't kill the shell nav.

### 2.2 SQLite specifics

`SQLITE_BUSY` → auto-retry 3× backoff → error; `constraint violation` → translate to VALIDATION fieldErrors where FK/UNIQUE is user-meaningful (uq_habitlog double-toggle, uq_journal daily dup); integrity_check failures at boot → **recovery mode**: read-only banner + "restore from backup" flow (data never auto-overwritten).

## 3. Logging — see chunk 12 §5 (taxonomy shared with error codes).

## 4. Environment configuration (spec §41)

Files: `.env.example` (committed, documented) · `.env.local` (dev overrides, gitignored) · `.env` (docker mount) · runtime env beats file. Validated by `config/env.ts` Zod → **fail boot fast with readable message** (secrets `zod.string().min()` but never logged; presence-check only).

```bash
# core
DATA_DIR=./data                 # db + attachments + backups — THE folder
DATABASE_URL=file:./data/personal-activity.db
HOSTNAME=127.0.0.1              # loopback default; LAN = explicit 0.0.0.0
PORT=3000
TZ=Asia/Jakarta                 # container must inherit user's TZ (local-date model)
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
# app behavior
ATTACHMENT_MAX_BYTES=10485760
ATTACHMENT_BACKEND=local        # local | memory (tests) | s3(stub, error if selected P1)
AUTH_ENABLED=false
# AUTH_SECRET=                    # required when AUTH_ENABLED=true
# AI_ENABLED=false
# AI_PROVIDER=ollama
# AI_OLLAMA_URL=http://127.0.0.1:11434
# AI_ALLOW_REMOTE=false
# AI_MODEL=llama3.2:3b
# OPENAI_API_KEY= / GEMINI_API_KEY=   # only with AI_ALLOW_REMOTE=true
LOG_LEVEL=info                  # dev: debug
```
`settings/data` shows non-secret resolved config. Git hygiene: `.gitignore` `data/`, `.env*` (keep `.env.example`), pre-commit gitleaks (chunk 09 §4). Docker: never bake env secrets into image; compose `env_file`.

## 5. Development environment (spec §42)

| Tool | Version / choice | Why |
|------|------------------|-----|
| Node.js | **22 LTS (≥22.12)** | Next 15 requires ≥18.18; 22 = current LTS with stable `node:sqlite` era runtime + better-sqlite3 prebuilds |
| Package manager | **pnpm ≥ 9** | spec; disk + workspace headroom |
| Git | required; trunk + short branches | spec |
| Editor | VS Code + ESLint, Prettier, Tailwind IntelliSense, drizzle-kit snippet, SQLite viewer ext (pointed at data file, read-only mode!) | spec |
| SQLite | bundled by better-sqlite3 — no system install; `sqlite3` CLI optional for poking | consistency |
| Docker | optional (deployment + Postgres-if-ever) | spec "optional" honored |
| Extra scripts | `pnpm dev` / `db:generate` / `db:migrate` / `db:studio` / `db:seed` / `db:reindex` / `test` / `test:e2e` / `verify` (lint+types+unit+integration) / `build` | agents run `verify` as gate |
| Onboarding doc | README = "what/where data lives/how to backup in 3 lines" | ownership ethos |
