# Chunk 09 — Authentication, Authorization, Privacy, Security, Deployment

## 1. Authentication evaluation (spec §21)

| Option | Fit for local-only single user | Verdict |
|--------|-------------------------------|---------|
| **Local-only access (no auth)** | The app is a file-backed tool on a personal device; the OS user *is* the account. Auth adds password loss risk + friction against "open and write" ethos. Server binds `127.0.0.1` by default → nobody else can reach it. | ✅ **MVP choice** |
| Custom session (hand-rolled cookie) | Reinvents the weakest part of security for little gain | ❌ |
| Auth.js (NextAuth v5) | Provider-oriented (OAuth) — exactly the third-party dependency privacy rejects; DB adapter heavier than needed | ❌ |
| Better Auth | Local-first design, passkey/password in own SQLite, light, TS-native | ⚠️ **Phase 2 opt-in** — the upgrade path we standardize on |

**Design:** `AUTH_ENABLED` (env) + `requireSession()` hook already threaded through every action/route (chunk 07 §3 rule 4) means enabling auth later adds *zero* new call sites. Tables `users(id, name, password_hash, created_at)` + `sessions(id, user_id, token_hash, expires_at, …)` shipped **from day one in schema** but empty-and-unused until flag flips (expand-migrate-contract compliance, and it keeps the backup contract stable). When enabled: single user row, argon2id via Better Auth, passkey optional, 30-day rotating sessions, lock screen `/lock`, failed-attempt backoff (in-memory + persisted counter), HTTPS-only cookie `__Secure-pa_session` when behind TLS else `SameSite=Lax` on localhost. Recovery = delete `sessions` rows via CLI `pnpm db:unlock` (documented escape hatch, physical access implies ownership per A4).

## 2. Authorization

MVP: one actor → **all-or-nothing read/write on the user's own data** post-login. No roles (spec §55). Two real rules do exist:
- `journal.private=1` excluded from AI contexts + from export *variants* chosen by user ("exclude private").
- Destructive surfaces (delete-everything, import-over) require typed confirmation + auto-backup.
Authz model documented so Phase-2 multi-device (chunk 15) would map capabilities onto same session.

## 3. Privacy architecture (spec §20)

| Concern | Answer |
|---------|--------|
| Where is data? | Entirely in `DATA_DIR` (db + attachments + backups) on the user's disk. No cloud, no sync, telemetry absent by default (`NEXT_TELEMETRY_DISABLED=1` baked). |
| How protected at rest? | Threat model A4: OS-account/disk boundary (FileVault/BitLocker/LUKS recommended in settings page). Optional Phase 3: SQLCipher or cryptomator folder. Documented honestly, not overclaimed. |
| Attachments? | Same disk; never embedded into 3rd-party previews; served only by our route with `private` cache + nosniff headers. |
| Network exposure? | Dev/prod bind `HOSTNAME=127.0.0.1`; Docker maps to LAN only with explicit `-p 127.0.0.1:3000` in compose; remote access recommended via **Tailscale/VPN, not public ports**. CSP forbids loading any remote script/font/style (self-host Inter via `next/font` local pipeline — build-time, runtime zero calls). No external `<img>` allowlisted. |
| Analytics? | None. Health page local-only. |
| AI & privacy? | Default provider `ollama` on loopback; remote providers need `AI_ALLOW_REMOTE=true` + per-feature consent modal with data-preview of exact text leaving the device. `private` journals and any text in `excluded_tags` stripped from prompts; redaction pass (emails/phone regex) before send. Full prompt+response audit log (local, redactable). See chunk 12 §3. |
| Backups? | ZIPs land in `data/backups` or user downloads; settings warns "backups are unencrypted — store accordingly"; optional password-protected AES ZIP (Phase 2, `--encrypted` export). |
| Search indexing? | FTS5 content lives inside the same local db — no secondary index service. |
| Sharing a screenshot? | Command palette "focus mode" hides journal bodies from lists (user choice, Phase 2). |

## 4. Security checklist (spec §37)

| Threat | Controls |
|--------|----------|
| **XSS** | React escaping; TipTap schema allowlist, no raw HTML persistence; `dangerouslySetInnerHTML` banned via lint; CSP `script-src 'self'`; file routes `sandbox` + `nosniff`; SVG blocked |
| **CSRF** | Server Actions carry Next origin verification; all state-changing HTTP routes same-origin `fetch` with custom header check; `Origin` allowlist middleware; cookies `SameSite=Lax` (+`Secure` behind TLS) |
| **SQL injection** | Drizzle query builder + prepared stmts only; no string SQL; dynamic sort columns via key-mapping enum; CI lint: raw sql template usage requires review tag |
| **Path traversal** | `storage_path` relative resolution with `resolve()` prefix assert; user filenames never in paths; export download filename server-generated |
| **File upload** | §08 pipeline (magic bytes, caps, tmp+commit, no exec bit concerns on target fs documented) |
| **MIME confusion** | Sniffed truth stored; served type from DB, not client; no-sniff header |
| **DoS on self** | Rate limiter (in-memory token bucket) on upload/import/health; import size ≤ 2× current db; max body 25 MB |
| **AuthN/Z** | §1/§2; session token = 256-bit, hashed at rest; rotation; revoke-all action |
| **Secrets** | `.env.local` gitignored + pre-commit secret scanner (gitleaks); config validated at boot (`zod` on env — fail fast, no secrets in logs); `AUTH_SECRET`/`AI_API_KEY` never client-prefixed |
| **Headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` deny camera/mic/geo/etc., CSP (chunk 05) |
| **Supply chain** | pnpm lockfile + `pnpm audit` CI gate (high+ blocks), `next` pinned minor, postinstall allowlist |
| **Error disclosure** | production generic messages + requestId; stack only server logs (§13) |
| **Physical loss** | settings recommends full-disk encryption + auto-backup reminder cadence |
| **Backup tamper** | sha256 manifest + `schema_version` check on import |
| **Dependency on CDN** | none; fonts bundled; offline install PWA |

## 5. Deployment environments (spec §43)

| Target | How | Privacy implication | Verdict |
|--------|-----|---------------------|---------|
| **localhost** dev | `pnpm dev` on `127.0.0.1:3000` | zero egress | primary daily use |
| **Self-host Docker** (NAS/VPS/home server) | `Dockerfile`: node:22-slim multi-stage, non-root `uid 1001`, volumes `./data:/app/data`, `HOSTNAME=0.0.0.0` **only inside private network/Tailscale serve**; healthcheck = `/api/health` | data stays on owned hardware; expose only if VPN; if public → auth flag mandatory | ✅ recommended distribution |
| Bare metal | `pnpm build && pnpm start` + systemd/cronicle, `backup.cron` copies data dir | as above | for tinkerers |
| **Vercel/Cloudflare/Render** | serverless | ❌ no persistent FS for SQLite+attachments (would force external DB/storage → breaks core promise); only after Phase-3 "optional cloud sync mode" with user-owned Postgres + S3-compatible bucket + E2E client-side encryption research | **not recommended** — documented why, honoring spec §43 |

Compose example contract (for chunk 15's `docker-compose.yml` blueprint, not code here): ports loopback, volume, env `TZ` (dates! A local-date model assumes the *device* TZ is the user's — container must inherit user TZ), restart policy, read_only root fs with tmpfs `/tmp`.

## 6. Session management details (Phase 2 auth mode)

Server-side `sessions` table; token = `sid.signature` cookie? No — opaque 32-byte base64url, stored hashed; cookie `httpOnly, sameSite=lax, secure=auto(if https detected)`, 30 d idle sliding with absolute 180 d cap, device list in `/settings/data` with "sign out everywhere," login from new device (LAN) allowed — passkeys preferred UX. Auth middleware at layout + action wrapper only; static asset requests unauthenticated by design (no user content served pre-auth; `/api/files/:id` **does** require session when flag on).
