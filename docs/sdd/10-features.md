# Chunk 10 — Feature Specification, Pages & Acceptance Criteria

Per feature: purpose → layout/components → data → actions → states → responsive → acceptance criteria (Given/When/Then, spec §53). Page-level template items from spec §48 all covered.

---

## 1. Dashboard `/` (spec §7)

**Purpose:** answer "how is today going, what's next" in one glance. Not a launcher, not a widget zoo.

**Layout (desktop 1120 px):** greeting line (`Good evening, Raka · Tuesday, October 2` + date pill) → metrics strip 4×`StatCard`: Activities today (n), Tasks (`done/total` + mini progress ring), Habits (`done/total` dots), Goals (avg active-goal %) → primary CTA `[+ Add activity]` (secondary: journal, task) → `Timeline` "Today's Timeline" (next/last 5 + "view day") → one rotating context card (empty-yesterday journal? → write-journal card; goal with milestone due? → that; else last journal snippet) → `DailyReflection` prompt inline if journal missing ("What did you accomplish today?" → opens journal).

**Data:** `getDashboardSnapshot(date)` = 5 queries (counts, next events, journal latest, habits summary, goals avg) — all covered by §06 indexes.
**Actions:** quick-add, habit toggles, task check inline, open journal.
**States:** first-run wizard (no prefs) → onboarding; zero data → 3 CTA cards with one line each, counters show `0` not dashes; action error → toast; stale data impossible (RSC).
**Responsive:** mobile order = greeting/counters(2×2 grid)/CTA/timeline/card; bottom nav present.
**AC:**
- Given a new user opens the app for the first time, when setup wizard completes, then dashboard shows zeros + CTA cards and no error.
- Given today has 3 activities, when user opens `/`, then timeline lists exactly those 3 ordered by start time, undated ones last.
- Given user completes an activity from dashboard, when action returns ok, then counters and timeline update without full reload and Undo toast appears.

## 2. Today `/today` (spec §7 variant, mobile-first)

Dense single-day sheet: hour-grain timeline (full day), sections Tasks-today / Habits (one-tap checks) / Journal status card / water-break style "gaps > 2 h" hint. Same data slice, day-scoped. AC: Given a habit already logged today, its chip shows checked state; tapping unlogs (second-tap undo toast).

## 3. Activities (spec §8)

**Model fields:** per chunk 06 `activities` table exactly covering spec list (`duration` stored derived; tags junction; location/mood/energy). CRUD + duplicate + search/filter/sort + tagging + timeline + calendar + attachments.

**List page `/activities`:** header + `[+ New]`; `EntityFilterBar` (date-range presets: today/7d/30d/custom, category chips, tag multi, status, priority, sort newest/oldest/longest) URL-synced; virtualized list rows: date chip, title, category dot, time range, duration, tags, status badge, mood; row click → detail dialog (`@modal`); multi-select (Phase 2 bulk). **Form:** title*, date*, all-day toggle OR start+end (duration live), category, tags, priority, status, location, mood, energy, description, goal link, attachments dropzone. Validation inline (Zod shared). **Detail:** everything + related tasks + attachments grid + edit/duplicate/delete.

**AC (spec §53 exemplar expanded):**
- Given user is on Activities, when they create "Coding" 15:00–17:00 Work, then it's stored, appears on dashboard & calendar & today timeline, is found by search "coding", and lists duration 120.
- Given an activity exists, when user duplicates to Oct 5, then a new id is created with `source_activity_id` set and attachments are *not* copied (link noted).
- Given filters `category=Health&status=done`, when reload/share URL, then same results reproduce.
- Given end<start, when save, then field error "End time must be after start time" server+client.
- Given delete (soft), when undo pressed within 8 s on toast, then row restored.

## 4. Journal (spec §9)

**Editor evaluation (spec asks select one):**

| | TipTap | Lexical | Markdown textarea |
|---|---|---|---|
| Structured persistence | ✅ JSON doc → DB + FTS plain | ✅ but custom pipeline | ➖ raw md, structure = convention |
| Prompt-section integration (one doc per section or sectioned doc) | ✅ extensions/prosemirror blocks | doable, more code | ➖ headings-by-convention |
| Mobile writing feel | ✅ native-ish WYSIWYG | ✅ | ➖ symbols visible |
| Images/attachments inline | ✅ node views ↔ upload flow | ✅ | ✅ link-style |
| Bundle / maintenance effort | med (but batteries) | high (DIY everything) | low |
| Autosave friendliness | ✅ onChange JSON | ✅ | ✅ |

**Choice: TipTap** — schema allowlist (paragraph, headings, lists, quote, bold/italic/link, image-node with local src) = XSS-safe + future Markdown/PDF export deterministic. (Markdown kept as *import/export format*, not editing format.)

**Entry model:** unique-per-date daily entry; fixed prompt fields (§06 schema) + `content_json` long-form. Opening `/journal/[date]` upserts nothing until first change (draft on first keystroke, debounce ≤ 2 s save, `status=draft`; explicit "Mark done" → final). Entry header: date nav (← →, today), mood+energy pickers, type (daily), private lock toggle, attachments, export md. Left rail (desktop): prompt outline jump; mobile: collapsible prompt sheet. `/journal` browse: month calendar w/ dots (dot intensity = has entry; color = mood), list-by-month toggle, search bar.

**AC:**
- Given user types in empty Oct 2 entry and waits 2 s, then `journals` row exists (draft) and reload keeps text; closing tab mid-debounce → beforeunload flush (sendBeacon fallback to save-draft action).
- Given an entry exists for today, when user hits ⌘J, then that entry opens (never a duplicate).
- Given user searches "visa", when journal body matches, then result shows with snippet at match.
- Given `private=1`, when AI summary runs, then its text is absent from prompt (AC asserted in chunk 12 tests).

## 5. Tasks (spec §13)

`/tasks`: four swimlanes Today / This week / Someday (no due) / Done (collapsible, today+yesterday) + overdue red banner; add row pinned top (`+ quick add` enter-to-create, ⌥-shift parses `!high`, `#tag`, `today`, `friday` — lightweight natural syntax, parsed client, validated server); drag reorder within lane (`sort_order` txn); swipe-complete mobile; filters by category/goal/tag/priority; link badges to goal/activity. Detail sheet: description, due date+time, goal, tags, attachments. Keep-simple guardrails: no projects/labels hierarchy/subtasks in MVP (Phase 3), statuses exactly 4.

**AC:**
- Given task "Fix router bug" due yesterday todo, when user opens /tasks, then it appears in overdue banner with danger accent and in Today list ("late" chip).
- Given complete, then `completed_at` set, lane moves with optimistic + reconcile, stats counters reflect same day, dashboard `5/7` updates.
- Given cancel, task leaves counts but stays history (not deleted).

## 6. Goals & Milestones (spec §10–11)

`/goals`: cards grid (active) + tabs Archived / Completed; card: title, category, progress bar/ring, deadline countdown ("42 d left" / overdue red), milestone mini-checklist top 3, linked counts (n tasks, n activities). Detail `/goals/[id]`: header (status chip, edit, archive), progress ring + mode toggle (auto ↔ manual slider), milestone list (add inline, checkbox toggles, drag order, optional due), description, linked tasks (inline complete) + linked activities (timeline excerpt) + attachments + notes-as-tag. Create: title, desc, category, priority, start, deadline, then starter milestone prompts. Status machine: `not_started → in_progress` auto when first milestone done; `completed` when 100% or manual; archived separate toggle.

**Progress strategy (spec §11):** default **auto = completed/total milestones**, rounded, live; empty = 0%. `progress_mode=manual` when outcome is fuzzy (health, learning vibes): slider 0–100; UI always shows which mode + formula tooltip ("3 of 5"). Rationale: milestones are the user's own decomposition — deriving from them avoids double bookkeeping and stale manual rot, while manual mode respects goals that resist decomposition. No weighted milestones in MVP (complexity); documented future.

**AC:**
- Given goal has 5 milestones 2 done, when viewing list/detail/dashboard, then 40% everywhere (single domain fn).
- Given auto mode, when user toggles last milestone, then status flips completed + confetti-free badge + revalidate.
- Given manual 65%, when a milestone toggles, progress stays 65% (mode respected).
- Given deadline Oct 30, calendar shows red marker from day past; dashboard goals card sorts overdue first.

## 7. Habits (spec §12)

`/habits`: active list with `HabitStrip` last 7 days dots (filled=done, outline-miss for daily past dates, neutral for not-yet; weekly habits show week progress `●●○ /3`), streak flame-number (text, not emoji-only), today check button (big tap target), archived tab; add-sheet: name, freq (daily/weekly/monthly), interval, target-per-period (weekly 3×), color. Detail per habit: `HabitHeatmap` 12 mo grid (click = toggle backfill), stats row (30-d rate, best streak, longest), history list w/ optional notes. Streak rules: daily = consecutive calendar days incl today-or-yesterday-not-yet gap grace; weekly = consecutive weeks hitting target; monthly analogous. Rate = hit periods / elapsed periods since creation (cap 100). MVP guard: no habit→activity auto-link, no smart schedules.

**AC:**
- Given streak 12 days logged daily, when checking today, then strip fills, streak → 13, dashboard `4/5 → 5/5`, all optimistic.
- Given yesterday missed, when viewing heatmap, then cell outline-miss; tapping toggles it and recomputes streak (now broken → shows best streak instead, honest).
- Given weekly habit target 3× with 2 logs this week, strip shows `2/3` not "missed".

## 8. Calendar (spec §14)

`/calendar`: segmented Month | Week | Day; month grid: day cells with up-to-3 event chips + `+n`, per-entity color dots row (activity=cat color, task=due, goal=deadline, habit=ring check, journal=dot), `types` filter popover persisted to URL; week: time-grid for timed activities + all-day lane, tasks on due day lane; day: reuses Timeline. Interactions: click cell → peek popover (events + "+ add activity/task" prefilled date), click event → detail modal route; keyboard arrows move cursor-day; month via ← → + date picker "jump". Mobile: swipe month, week horizontally scrollable, add via FAB prefills. Data: single `getEventsForRange` union query (≤ 6 weeks cells) — indexed. AC: Given filter types hides habits, heatmaps unaffected elsewhere; Given activity 09:00–10:30, week view positions block correctly (offsets for 2 same-slot stack); Given task w/o due date never renders.

## 9. Timeline (spec §15)

Shared `Timeline` component (dashboard/today/day/calendar-day): left hour rail with "now" marker line; items = timed activities (block height ∝ duration), journal entry flag at evening slot, tasks w/ time shown inline; gap visualization ("2 h gap — log something?" quick-create prefill start=gap-begin); undated items under "Whenever" tail. AC: Given events 08/10/13/15/19 matching spec mock, render order+labels identical concept; Given event in-progress, pulsing dot (reduced-motion safe).

## 10. Statistics (spec §16)

See chunk 11 §3 (architecture) — pages: `/statistics` tabs Day|Week|Month: cards row (counts), category distribution bar/donut, productive-hours line, habit consistency grid, mood sparkline, task completion funnel, journal streak calendar; "Weekly review" CTA (§03 flow). Phase-1 ships counters-only (cards), charts Phase 2.

## 11. Search `/search` + ⌘K

chunk 11 §1. AC: Given query "Next.js", results grouped by entity with type chips + snippet + date, keyboard nav, Enter opens entity; empty query shows recents+quick-nav.

## 12. Settings & preferences `/settings/*`

- `/settings`: index cards to sub-pages, app version, storage usage.
- `/settings/preferences`: display name, theme (system/light/dark), week start, time format, date format preview, density, default journal prompts visibility, locale notes.
- `/settings/data`: storage provider, max upload size, verify attachments action, delete-everything (typed confirm + forced export), session/devices (P2 auth).
- `/settings/backup`: chunk 11 §2.5.
- `/settings/shortcuts`: enable/disable, remap 4 capture chords, cheat-sheet (P2 remap).
- AC: Given name changed, dashboard greeting updates immediately (revalidate + optimistic). Given theme=system + OS dark, reload no flash (cookie + inline class script).

## 13. Cross-cutting API-level acceptance (AC-API-1)

Every mutation exposed as action is covered by an integration test hitting real SQLite temp file; service layer has no Next imports → same functions testable without framework; `queries.ts` golden-SQL EXPLAIN assertions in CI.
