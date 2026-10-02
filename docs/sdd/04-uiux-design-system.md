# Chunk 04 — UI/UX Specification & Design System

## 1. UX principles (spec §22)

1. **Calm tool, not dashboard toy.** Content-first chrome; color reserved for meaning (status, category, mood), never decoration. No gradients, glassmorphism, or hero animations.
2. **Glanceable today.** The only question on `/`: "how is today going + what's next." Secondary data lives one tap away.
3. **Capture in seconds.** Every creation path ≤ 3 interactions; keyboard and FAB parity.
4. **Write without interruption.** Journal autosaves, no modal confirmations while typing, distraction-free width.
5. **Reversible actions.** Destructive ops confirm once, soft-delete where valuable, Undo toast where possible.
6. **One thing per surface.** No card with two different metrics; no list with more than one primary action inline.
7. **Density switch** (compact/comfortable) in preferences for power users, default comfortable.
8. **Empty states teach**, errors explain and offer the next click.

## 2. Layout system

- App shell: CSS grid `[sidebar 240px | main 1fr]`; sidebar collapses to 64 px rail (< 1280 px auto, toggle manual).
- Content max widths: forms 640 px, reading (journal) 720 px, lists/tables full fluid up to 1280 px, dashboards 1120 px.
- Spacing scale: 4 px base → `0.5/1/1.5/2/3/4/6/8` tailwind tokens; card gap `gap-4`; section gap `mt-8`.
- Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`; mobile nav swaps at `md`.
- Page structure template: `PageHeader (title + primary actions) → filters bar (if any) → content → pagination/infinite`.

### Dashboard information budget (anti-overload rule, spec §7)

Exactly 4 zones, ordered: ① greeting+date+counters strip ② primary CTA row (quick add) ③ today timeline (next 5 + collapse) ④ one rotating card (journal snippet | current goal | habit ring — chosen by recency heuristic). Anything else is a nav link, never a card.

## 3. Typography (spec §25)

**Evaluation:**

| Font | Pros | Cons | Verdict |
|------|------|------|---------|
| Inter | UI legend, tabular nums, variable, excellent screen hinting | ubiquitous | ✅ **Chosen (UI + body)** |
| Geist | Matches Vercel aesthetic, crisp | limited weights historically, weaker long-form body | rejected |
| Plus Jakarta Sans | friendly character | looser fit numbers, less neutral for dense tables | rejected |

Scale (desktop / mobile in parentheses, rem):
`display 30(24) · h1 24(20) · h2 20(17) · h3 16(15) · body 15(14) · journal body 17(16) leading-1.7 · caption 13 · micro 12 · tabular 13` — journal reads intentionally larger; weights: regular(400) body, medium(500) UI, semibold(600) headings only. `font-feature-settings: "tnum"` on all metrics/counts/times.

## 4. Color system (spec §25–26)

Neutral-first, semantic tokens as CSS variables in `globals.css` (shadcn convention), light + dark + high-contrast-dark sets. Light: `bg oklch(0.99 0.002 265)`, `surface oklch(0.985 …)`; dark: `bg oklch(0.17 0.008 265)` — never pure `#000` (halation). Text `foreground` on `background` ≥ 12:1, muted text ≥ 4.8:1.

| Token | Light (oklch) | Dark | Use |
|-------|--------------|------|-----|
| `background` | 0.995 | 0.17 | page |
| `surface` / `card` | 1.0 | 0.21 | cards, sidebar |
| `foreground` | 0.22 | 0.96 | main text |
| `muted-foreground` | 0.50 | 0.70 | secondary text |
| `border` | 0.92 | 0.28 | hairlines (1px, never shadows-only) |
| `primary` | 0.45 (ink navy `oklch(0.45 0.12 262)`) | 0.72 same hue | CTAs, links, focus |
| `primary-foreground` | 0.99 | 0.18 | |
| `accent` | 0.95 tint of primary | 0.28 tint | hover fills, selected rows |
| `success` | 0.62 0.17 152 | 0.72 0.17 152 | done, saved, habit check |
| `warning` | 0.75 0.15 85 | 0.80 0.14 85 | overdue soon, streak-at-risk |
| `danger` | 0.58 0.21 27 | 0.64 0.20 25 | delete, overdue, validation |
| `ring` | primary α 40% | | focus-visible 2px |

Category colors are a fixed 8-slot pastel set ( Work `#4C6EF5`, Study `#7C3AED`, Personal `#0EA5E9`, Health `#10B981`, Exercise `#F59E0B`, Project `#EC4899`, Family `#14B8A6`, Other `#94A3B8`) used *only* for dots/heatmap/badges; both modes desaturate dark variants. Mood scale = 5 neutral-to-warm swatches. Priority = text + border treatment, not red-everything.

Dark mode: three states light/dark/system (`next-themes`, class strategy, system default); charts swap axis/grid tokens; images dimmed via `brightness(0.9)` optional. Elevation: `shadow-2xs/xs` only for floating layers (menu, dialog) — flat cards separated by border + 0.5 surface step.

## 5. Iconography & motion

- **Lucide** throughout, 1.5px stroke, sizes 14/16/20; never emoji as sole meaning carrier.
- Motion: 150–200 ms ease-out for dialogs/dropdowns; layout shifts 0 anim by default; skeletons fade-in 100 ms; `prefers-reduced-motion: reduce` kills all transitions except opacity.
- No parallax, no count-up animations, no confetti (streak milestones get a subtle badge, not fireworks).

## 6. Component inventory (spec §25)

Base primitives from **shadcn/ui** (Radix under the hood): Button, Input, Textarea, Select, Dialog, Drawer(mobile vaul), Sheet(sidebar), DropdownMenu, Tooltip, Toast(sonner), Tabs, Badge, Card, Command, Popover, Calendar, DatePicker, TimeField, Progress, Avatar, Switch, Checkbox, RadioGroup, Form(Zod-driven), Skeleton, Empty, ScrollArea, Separator, Alert.

Custom composite components:

| Component | Description |
|-----------|-------------|
| `AppSidebar` / `BottomNav` / `MoreSheet` | navigation per §2 |
| `QuickAddSheet` | type picker → minimal inline form |
| `Timeline` | hour rail + event blocks, "now" line, gap detection, click-to-create |
| `CalendarMonth / Week / Day` | event dots + ranges, type filters |
| `HabitStrip` (7/30 dots) · `HabitHeatmap` (12-mo grid, GitHub-style but neutral palette) | |
| `GoalCard` + `RingProgress` | milestone checklist inline |
| `StatCard`, `ProductivityStrip` | dashboard counters, tabular |
| `MoodPicker`, `EnergyPicker` | 5-step segmented, aria labels |
| `AttachmentDropzone`, `FileCard`, `ImagePreviewDialog` | |
| `JournalEditor` | TipTap wrapper + prompt sidebar + save state |
| `CommandPalette` | ⌘K: nav, search, create |
| `EntityFilterBar` | URL-synced multi-facet filter |
| `DatePill` | today-style localized date chip |
| `EmptyState`, `ErrorState`, `OfflineBanner`(P2), `PaginationBar`, `InfiniteList` | |
| `ChartCard` | Recharts wrapper w/ theme tokens, SR data table fallback |
| `TagInput` | combobox create-or-select |
| `ConfirmDialog`, `UndoToast` | destructive/create affordances |

## 7. Keyboard shortcuts (spec §27)

| Keys | Action | Scope |
|------|--------|-------|
| ⌘/Ctrl+K | Command palette / global search | global |
| ⌘/Ctrl+N | New activity (Quick Add pre-selected) | global |
| ⌘/Ctrl+J | Open today's journal | global |
| ⌘/Ctrl+T | New task | global |
| ⌘/Ctrl+B | Toggle sidebar | desktop |
| `?` | Shortcuts help dialog | global (not in field) |
| `E` | Edit focused item | lists |
| `Enter` / `Esc` | open / close dialog | dialogs |
| ⌘/Ctrl+Enter | Save form/journal | forms |
| `/` | Focus search | lists |
| `G then D/T/C/J…` | Go to Dashboard/Today/Calendar/Journal | global (Phase 2) |

Conflict rule: single-letter shortcuts ignored inside inputs/editors. Users can disable all or remap the four capture chords in `/settings/shortcuts` (stored in `preferences`, implemented as client state in `ShortcutProvider`; registry data-driven so remap = config change).

## 8. Accessibility strategy (spec §36)

- All interactive components from Radix → focus trap, aria, keyboard patterns pre-solved; custom components inherit shadcn primitives, never re-implement dialog/menu.
- Route change → move focus to `h1` region (`tabIndex={-1}`), announce via `role=status` live region ("Tasks, loaded 12 items").
- Forms: `Form` component wires label↔input, `aria-invalid`, error text via `aria-describedby`; errors summarized above submit with links.
- Timeline/calendar: visual grid is `aria-hidden`; parallel `sr-only` semantic list of events with same data. Heatmap cells are buttons with `aria-label="March 14, 2026, completed"`.
- Color: never sole signal — status chips = dot + text; charts use pattern + direct labels. Contrast automated in CI (`axe` in Playwright, eslint-plugin-jsx-a11y error level).
- Focus-visible ring always ≥ 3:1 against adjacent; min touch target 44×44 px on mobile (`min-tap` utility).
- Reduced-motion honored globally; density switch keeps text resizable to 200% without breakage.
- Time inputs: 24h and 12h per preference; dates localized `Intl`.

## 9. Tone of voice & copy rules

- Microcopy sentence case, no exclamation marks in system states. Buttons = verb + object ("Add activity", "Save entry", "Restore backup"). Errors: what happened + what to do ("Couldn't save — file exceeds 10 MB. Compress or attach a smaller file."). Greetings: "Good morning/afternoon/evening, {name}". Empties: one line + single CTA ("No tasks for today. Add one with ⌘T."). Delete confirmations state cascade truth ("This also removes 2 attached photos").

## 10. Responsive behavior contract

- 2-column dashboard desktop → single column ordered: counters, CTA, timeline, card. Filters bar wraps into "Filter" sheet on mobile. Data tables (backup history, statistics detail) become stacked cards. Dialog → vaul drawer bottom-sheet < md. Date pickers full-screen sheet on mobile. TipTap toolbar collapses into overflow menu; prompt labels become collapsible sections. Charts: width 100%, legend below, max 5 series else switch to list.
