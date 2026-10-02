# Chunk 15 — Final SDD Index & Final Recommendation (spec §56–57)

## 1. SDD structure map (spec §56 — all 48 sections, located)

| # | Section | Chunk | # | Section | Chunk |
|---|---------|-------|---|---------|-------|
| 1 | Executive Summary | 01 | 25 | Authorization | 09 §2 |
| 2 | Product Vision | 01 | 26 | Security | 09 §4 |
| 3 | Goals and Objectives | 01 | 27 | Validation | 05 §6 |
| 4 | Scope | 01 | 28 | State Management | 05 §5 |
| 5 | Assumptions | 01 | 29 | Performance | 05 §7 |
| 6 | Functional Requirements | 02 §1 | 30 | Offline Strategy | 12 §2 |
| 7 | Non-Functional Requirements | 02 §2 | 31 | PWA Strategy | 12 §1 |
| 8 | User Personas | 02 §3 | 32 | Backup and Restore | 11 §2 |
| 9 | User Stories | 02 §4 | 33 | Search Architecture | 11 §1 |
| 10 | User Flows | 03 §1 | 34 | Statistics Architecture | 11 §3 |
| 11 | Feature Specification | 03 §4 + 10 | 35 | AI Integration | 12 §3 |
| 12 | UI/UX Specification | 04 | 36 | Notification System | 12 §4 |
| 13 | Design System | 04 §3–6 | 37 | Error Handling | 13 §2 (+11 §4) |
| 14 | Information Architecture | 03 §2 | 38 | Logging | 12 §5 |
| 15 | System Architecture | 05 §2 | 39 | Testing Strategy | 13 §1 |
| 16 | Technology Stack | 05 §3 | 40 | Folder Structure | 05 §4 |
| 17 | Technical Decision Matrix | 05 §3 | 41 | Development Environment | 13 §5 |
| 18 | Database Architecture | 06 §1 | 42 | Deployment Strategy | 09 §5 (+13 §4) |
| 19 | ERD | 06 §3 | 43 | Technical Risks | 14 §4 |
| 20 | Database Schema | 06 §4–6 | 44 | MVP Roadmap | 14 §1 |
| 21 | API Architecture | 07 §1–2 | 45 | Future Roadmap | 14 §1 (P3) + 15 §4 |
| 22 | Server Actions | 07 §3–4 | 46 | Acceptance Criteria | 10 (per feature), 11 §3.4, 08 |
| 23 | File Storage Architecture | 08 | 47 | Development Order | 14 §3 |
| 24 | Authentication | 09 §1 | 48 | Final Architecture Recommendation | this chunk |

## 2. Recommended stack (final)

```text
Next.js 15 (App Router, RSC) + React 19 + TypeScript 5.7 (strict)
Tailwind CSS v4 + shadcn/ui + Lucide + Inter (next/font local)
SQLite (better-sqlite3, WAL) + Drizzle ORM + drizzle-kit migrations
Zod v4 (validation single source) · date-fns v4 · uuid v7
TipTap (journal) · Recharts (statistics P2) · vaul/radix (sheets) · sonner (toasts)
Vitest + Playwright + axe-core · pino (logs) · fflate (zip) · sharp (thumbs) · pnpm · Node 22 LTS
Storage: LocalStorageProvider (filesystem) behind StorageProvider interface
Auth: none in MVP · Better-Auth behind AUTH_ENABLED flag (P2)
AI: none in MVP · AIService interface + NullProvider (P3: Ollama default)
```

## 3. Recommended architecture (final diagram)

```mermaid
flowchart TD
    subgraph UserDevice["User device — everything local"]
        B["Browser / installed PWA (P2)"] --> N["Next.js 15 server process · localhost"]
        N --> L1["Presentation: App Router, RSC + minimal client islands"]
        L1 --> L2["Application: Server Actions (mutations) + Route Handlers (files/export/search)"]
        L2 --> L3["Services (feature slices) + lib/domain pure functions"]
        L3 --> L4["Data: repositories → Drizzle → better-sqlite3"]
        L3 --> P1["StorageProvider → data/attachments (FS)"]
        L3 --> P2x["AIService → NullProvider (P3: Ollama loopback)"]
        L4 --> D[("data/personal-activity.db — WAL + FTS5")]
    end
    D -.->|"export ZIP = data.json + metadata + schema-version + attachments/" BK["User-owned backups"]
    BK -.->|"import (validate → preview → auto-backup → txn)" D
```

## 4. Recommended database · storage · MVP (recaps for decision-makers)

**Database: SQLite + Drizzle (Option A).** One owned file; WAL + FTS5 + JSON1 cover search and structured journal content; backup = copy; Postgres path documented if a real second device/multi-writer requirement ever emerges.

**Storage: filesystem under `DATA_DIR/attachments`, interface-seam for future S3/Cloud providers.** Magic-byte validation, uuid naming, date-sharded dirs, no blobs in the database.

**MVP (Phase 1) — implement exactly:** setup → design system + shell → db+architecture → activity slice (template) → journal → attachments → tasks → goals+milestones → habits → calendar+timeline → dashboard+today → search → settings → stats counters → backup/restore → test hardening → manifest. **Nothing else.**

**Features to postpone (explicit):** habits-extras, charts, offline/outbox PWA, notifications, auth, AI, multi-device sync, REST CRUD shim, i18n, automation engine, encryption, social/any sharing, native apps. (Full rationale: chunk 14 §5.)

## 5. Future roadmap (beyond P3, documented seams only)

User-owned cloud sync (devices see each other via E2E-encrypted relays or CRDT experiments — needs real demand), at-rest encryption provider, plugin/field extensions for custom entity metadata, mobile share-sheet ingestion, knowledge-graph style browsing of activities↔goals. Each enters through an existing port (`StorageProvider`, sync outbox contract, `preferences`, AI provider list) — none require reshaping the core.

---

## How to use this SDD as an implementer (human or AI agent)

1. Read chunk 01 → 05 once end-to-end (boundaries, decisions, folder contract).
2. For any task: open the chunk that owns the layer (schema changes → 06; action changes → 07/10; UI → 04/10; files → 08; backup → 11 §2).
3. Follow chunk 14 §3 order — slice the first vertical (Activities) as the pattern, then repeat.
4. Every feature PR must satisfy its acceptance criteria (chunk 10) + run `pnpm verify`.
5. If reality forces a deviation from this document, update the doc in the same PR (it is the blueprint, not a monument).
