# Chunk 02 — Requirements

## 1. Functional Requirements

Priority: **M** = must (Phase 1), **S** = should (Phase 2), **C** = could (Phase 3).

### FR-A Activities

| ID | Requirement | P |
|----|-------------|---|
| FR-A1 | Create/read/update/delete activity with fields: title, description, category, date, startTime, endTime, duration (derived), status, priority, location, mood, energyLevel, tags | M |
| FR-A2 | Duplicate activity (same day or chosen date) | M |
| FR-A3 | Filter by date range, category, tag, status, priority, mood; sort by date/start/priority; free-text search within list | M |
| FR-A4 | Activity detail shows attachments, related tasks, linked goal | M |
| FR-A5 | Statuses: Planned / In Progress / Done / Cancelled. Completing from list is one tap | M |
| FR-A6 | Timeline and calendar projections of activities | M |
| FR-A7 | Convert activity ↔ task (copy fields, keep link) | S |
| FR-A8 | Recurring activity templates | C |

### FR-J Journal

| ID | Requirement | P |
|----|-------------|---|
| FR-J1 | One journal entry per date (unique constraint); create/edit with structured prompts: mood, energy, what happened, accomplished, went well, did not go well, learned, improve tomorrow, gratitude, notes | M |
| FR-J2 | Rich text via TipTap JSON; plain-text extraction for search | M |
| FR-J3 | Autosave draft (debounced ≤ 2 s after pause) with visible save state | M |
| FR-J4 | Browse by date, month list, search; date filter | M |
| FR-J5 | Attachments per entry | M |
| FR-J6 | Export single entry as Markdown | S |
| FR-J7 | Lock/private entries excluded from AI context by default | S |

### FR-T Tasks

| ID | Requirement | P |
|----|-------------|---|
| FR-T1 | Task CRUD: title, description, status (Todo/In Progress/Done/Cancelled), priority (Low/Med/High/Urgent), dueDate, category, tags, optional goalId, optional activityId | M |
| FR-T2 | Quick-add list ("today", "next 7 days", "overdue", "done today") | M |
| FR-T3 | Complete/uncomplete updates `completedAt`; stats consume it | M |
| FR-T4 | Reorder within list (manual sort index) | S |
| FR-T5 | Subtasks | C |

### FR-G Goals & milestones

| ID | Requirement | P |
|----|-------------|---|
| FR-G1 | Goal CRUD: title, description, category, priority, startDate, deadline, status (Not Started/In Progress/Completed/Archived), progressMode (auto/manual), manualProgress | M |
| FR-G2 | Milestones CRUD under a goal: title, done, dueDate optional, sortOrder | M |
| FR-G3 | Auto progress = completed milestones / total milestones; manual override when progressMode=manual; empty milestones → 0% (or manual) | M |
| FR-G4 | Link tasks and activities to goal; goal page aggregates them | M |
| FR-G5 | Goal deadline appears on calendar | M |
| FR-G6 | Archive hides from active lists, keeps history | M |
| FR-G7 | AI: break goal into milestones/tasks | C |

### FR-H Habits

| ID | Requirement | P |
|----|-------------|---|
| FR-H1 | Habit CRUD: name, description, frequency (daily/weekly/monthly + `intervalCount`), targetPerPeriod (for weekly e.g. 3×/week), active flag, color, archivedAt | M |
| FR-H2 | Log completion for a specific date (toggle); one row per (habit, date); backfilling past days allowed | M |
| FR-H3 | Streak (current + best) and completion rate computed | M |
| FR-H4 | Calendar heatmap (last 12 months) per habit; 7-dot strip in list | M |
| FR-H5 | Habit completion today on dashboard/today page | M |
| FR-H6 | Habit reminders | S |

### FR-C Calendar & timeline

| ID | Requirement | P |
|----|-------------|---|
| FR-C1 | Month/week/day views; events from activities, due tasks, goal deadlines, habit due markers, journal-exists dot | M |
| FR-C2 | Filter which entity types show | M |
| FR-C3 | Click day → day detail with timeline; click event → detail | M |
| FR-C4 | Drag-to-create activity on month/week grid | C |
| FR-C5 | Timeline component: hour rail + items, empty-state prompts | M |

### FR-S Search

| ID | Requirement | P |
|----|-------------|---|
| FR-S1 | Global FTS5 search across activities, journals, tasks, goals (title+desc/body), tags | M |
| FR-S2 | Command palette (Ctrl/Cmd+K) with instant results + page routes `/search?q=` | M |
| FR-S3 | Filter results by type, date range | S |
| FR-S4 | Attachment filename search | S |

### FR-B Backup / data ownership

| ID | Requirement | P |
|----|-------------|---|
| FR-B1 | Export all data: JSON (full, canonical), CSV (per-entity zip), ZIP (data.json + metadata.json + schema-version.json + attachments/) | M |
| FR-B2 | Import backup with schema-version check, validation, duplicate strategy (merge-by-id default), transactional apply, error report | M |
| FR-B3 | Pre-import automatic safety backup stored under `data/backups/auto/` | M |
| FR-B4 | Single-entity quick export (journal → Markdown) | S |

### FR-D Dashboard, reflection, stats

| ID | Requirement | P |
|----|-------------|---|
| FR-D1 | Dashboard: greeting + date, today counters (activities, tasks done/total, habits done/total, goal avg %), today timeline, recent journal snippet, quick actions | M |
| FR-D2 | Daily reflection = journal prompts for today (same entity, FR-J) | M |
| FR-D3 | Statistics page: daily/weekly/monthly metrics, category distribution, mood trend, habit consistency | S (counts M, charts S) |
| FR-D4 | Weekly/monthly reflection template entries | S |
| FR-D5 | AI daily summary / weekly review / themes | C |

### FR-U UI/platform

| ID | Requirement | P |
|----|-------------|---|
| FR-U1 | Dark / light / system theme with persisted preference | M |
| FR-U2 | Collapsible sidebar (desktop), bottom nav + FAB + "More" sheet (mobile) | M |
| FR-U3 | Keyboard shortcuts: ⌘/Ctrl+K search, N activity, J journal, T task, ? shortcut help; user-disableable | S |
| FR-U4 | Quick Add sheet: Activity/Journal/Task/Goal/Habit in ≤ 2 interactions | M |
| FR-U5 | PWA installable + offline app-shell | S |
| FR-U6 | Preferences: locale-agnostic date/time format, week start, attachment limits | M |
| FR-U7 | Local auth gate (passkey or password) when enabled | S |

## 2. Non-Functional Requirements

| Category | NFR | Target |
|----------|-----|--------|
| Privacy | Core features with zero network | 100% — no mandatory outbound calls; CSP forbids it (§09) |
| Privacy | Third-party scripts in MVP | 0 (analytics excluded by default) |
| Performance | Server action p50 / p95 (list queries ≤ 5k rows) | < 30 ms / < 150 ms |
| Performance | Dashboard TTI local | < 1.5 s; Lighthouse mobile ≥ 85 perf |
| Performance | Search | < 200 ms p95 over 10 years of entries |
| Performance | Attachment upload 5 MB image | < 2 s on local disk |
| Scale | Design ceiling | 100k activities / 10k journals / 1M habit_logs still indexed-fast; beyond → PG path |
| Reliability | Durability | SQLite WAL; no lost writes on clean exit; auto-VACUUM weekly |
| Reliability | Backup integrity | Import validates checksum+version; restore proven by CI test |
| Usability | Capture friction | New activity in ≤ 3 interactions from dashboard |
| Usability | Journal uninterrupted typing | Autosave without focus loss or modals |
| Accessibility | WCAG 2.1 AA | Contrast ≥ 4.5:1 text, full keyboard paths, SR labels, reduced-motion |
| Maintainability | Single developer + AI agents | Feature folders vertical-sliced; strict TS; ≤ 300 LOC/component guideline |
| Maintainability | Coverage | ≥ 80% on services/utils; every FR has an integration test |
| Portability | OS | Windows / macOS / Linux dev; Docker linux deployment |
| Data ownership | Location | Everything under `DATA_DIR` (default `./data`) |
| i18n | Strings externalized where cheap | Phase 3 (`next-intl`) |

## 3. User Personas

### P1 — "Raka, the solo builder" (primary)
28, software developer, freelances, works from home. Wants to prove to himself where his day went, keep a private journal without handing thoughts to a big-tech cloud, track a learning goal (Next.js) with visible progress. Uses laptop 80% / phone 20%. Cares: speed of capture, dark mode, own-the-data. Tolerates: no sync between devices if backup covers it.

### P2 — "Dinda, the structured student"
21, university student. Needs daily habit streaks (study, exercise, reading), assignment-like tasks with due dates, calendar week view for classes. Mobile-first. Cares: beautiful simple UI, streaks motivation, low typing effort. Tolerates: installing PWA on phone.

### P3 — "Pak Aryo, the reflective professional"
41, manager. Journals every evening, tracks quarterly goals with milestones, reviews monthly statistics to prepare self-assessment. Values privacy above all — will not paste journal into any external AI. Cares: export, encryption later, calm typography for long reading. Tolerates: running Docker on a home NAS.

Edge roles deliberately *not* personas: team, admin, shared household device (out of scope).

## 4. User Stories

Format: story → acceptance criteria live in chunk 10; key ones referenced here.

### Activities
- US-01 As a user, I can log an activity with title/category/time range so I can see my day later. (FR-A1)
- US-02 As a user, I can mark an activity Done from the today list in one tap. (FR-A5)
- US-03 As a user, I can tag activities ("deepwork", "client-x") and filter by tag. (FR-A1/A3)
- US-04 As a user, I can duplicate yesterday's standup activity onto today. (FR-A2)
- US-05 As a user, I can attach a photo of my whiteboard notes to an activity. (FR-A1, §08)
- US-06 As a user, I can record mood/energy with an activity so weekly trends make sense. (FR-A1)

### Journal
- US-10 As a user, opening "Journal for today" always shows my existing entry or a fresh template — never a forked copy. (FR-J1)
- US-11 As a user, my writing is saved automatically while I type. (FR-J3)
- US-12 As a user, I can pick a mood emoji and it appears in stats trends. (FR-J1, §11)
- US-13 As a user, I can search "visa application" and find the March journal paragraph. (FR-S1)
- US-14 As a user, I can attach my running screenshot to the entry. (FR-J5)

### Tasks / goals / habits
- US-20 As a user, I see today's tasks vs overdue vs done in three glanceable lists. (FR-T2)
- US-21 As a user, a task can point at goal "Learn Next.js" so goal page shows related work. (FR-T1/G4)
- US-30 As a user, my goal progress auto-updates as I check milestones. (FR-G3)
- US-31 As a user, I can set 65% progress manually for an ambiguous goal. (FR-G1)
- US-32 As a user, an overdue goal deadline shows red on calendar. (FR-G5)
- US-40 As a user, I check "Read" habit today and my 12-day streak grows. (FR-H2/H3)
- US-41 As a user, I backfill a missed yesterday from the heatmap. (FR-H2)
- US-42 As a user, weekly habit "Gym 3×/week" shows this week's dots, not 7-day daily expectation. (FR-H1)

### Calendar / timeline / dashboard
- US-50 As a user, month view shows colored dots per entity type; toggling hides habits. (FR-C1/C2)
- US-51 As a user, tapping a day opens timeline ordered by startTime with gaps visible. (FR-C5)
- US-52 As a user, dashboard answers "how is today going?" in < 5 s. (FR-D1)

### Data ownership / privacy / AI
- US-60 As a user, one click downloads a ZIP containing everything. (FR-B1)
- US-61 As a user, I restore that ZIP on a fresh install and all links survive. (FR-B2)
- US-62 As a user, I can enable a PIN/passkey lock before sharing my laptop screen context. (FR-U7)
- US-70 As a user, AI weekly summary runs against local Ollama only unless I explicitly allow cloud. (FR-D5, §12)

### Reflection / stats
- US-80 As a user, Sunday I get a weekly review worksheet pre-filled with counts. (FR-D4)
- US-81 As a user, monthly chart shows productive hours vs category mix. (FR-D3)
