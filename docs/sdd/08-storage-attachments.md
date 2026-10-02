# Chunk 08 — File Storage Architecture & Attachments (spec §5, §18)

## 1. Storage option evaluation

| Criterion | Local filesystem | SQLite BLOB | IndexedDB | Object storage (S3) |
|---|---|---|---|---|
| Backup simplicity | ★★★★ (copy dir) | ★★★★★ (in db file) | ★★ (browser) | ★★ (separate export) |
| DB bloat / integrity risk | ★★★★★ none | ★★ VACUUM pain, corruption blast radius | n/a | ★★★★★ |
| Streaming/preview perf | ★★★★★ sendfile + Range | ★★★ memory + txn | ★★★★ | ★★★★ |
| Privacy | ★★★★★ on-device | ★★★★★ | ★★★★ | ★★ (third party!) |
| Multi-host scale | ★★ | ★ | ★ | ★★★★★ |
| MVP fit | ✅ chosen | ❌ "no large files in DB" per spec | ❌ browser-bound | ❌ future phase |

**Decision: local filesystem under `DATA_DIR`, with a provider abstraction so `LocalStorageProvider → S3StorageProvider/CloudStorageProvider` swaps later without touching business logic.**

## 2. Directory layout

```text
data/
├── personal-activity.db
├── attachments/
│   ├── activities/2026/10/{uuid}.jpg        # primary, extension from validated MIME
│   ├── journals/2026/10/{uuid}.pdf
│   ├── tasks/2026/10/{uuid}.png
│   └── goals/2026/10/{uuid}.webp
├── thumbs/{attachmentId}.webp               # 512px, quality 78 (images only)
└── tmp/uploads/                             # streaming target before commit, purged hourly
```

Path rule: `{entityType}/{yyyy}/{mm}/{attachmentUuid}{ext}` — DB `storage_path` stores relative path only. Entity type from allowlist enum, date from attachment id (v7 timestamp), uuid generated server-side — user filename never touches the path (spec §18 "secure file naming").

## 3. StorageProvider interface (port)

```ts
interface StorageProvider {
  put(stream: ReadableStream, key: string, meta: {size, mime}): Promise<{ok:true} | FileError>;
  get(key: string): Promise<ReadableStream>;        // lazy, supports Range upstream
  head(key: string): Promise<{size, etag} | null>;
  delete(key: string): Promise<void>;
  createReadStream(key, {start?, end?}): Readable;  // for /api/files
  ensureDir(sub: string): Promise<void>;
  usageBytes(): Promise<number>;                    // dashboard/storage settings
}
```

Adapters: `local-fs.ts` (default), `memory.ts` (tests), `s3.ts` (stub only — Phase 3, never default). Selection via `STORAGE_PROVIDER` env + factory; **attachment service depends only on the interface** (verified by boundary lint rule: no `fs/promises` import outside `lib/storage` + `lib/files`).

## 4. Upload pipeline (acceptance-grade detail)

Steps, all server-side in `POST /api/attachments` (chunk 07 §2):

1. **Parse multipart** via Web `FormData` (Next runtime). Reject if no file.
2. **Size cap**: `size_bytes ≤ preferences.attachment_max_bytes` (default 10 MB; env ceiling `ATTACHMENT_MAX_BYTES`). Enforced twice: header-ish check on `file.size`, and byte-limited stream write to `tmp/uploads` (defense against lies). 413 `FILE_TOO_LARGE`.
3. **Type validation**: allowlist by *sniffed magic bytes* (`lib/files/magic-mime.ts`), not client-declared MIME. Allowed set: JPG `FF D8 FF`, PNG `89 50 4E 47…`, WEBP `RIFF….WEBP`, GIF (optional), PDF `%PDF-`. Client MIME must *also* be in allowlist (double gate). Mismatch → 415 `FILE_TYPE_UNSUPPORTED`. Extension derived from sniff result, never from original filename.
4. **Sanitize display name**: `original_name` stored for UX only, length ≤ 150, control chars stripped, no path separators (download filename built via RFC 5987 `filename*`).
5. **Write to tmp → hash**: stream to tmp, `sha256` computed in-flight (dedupe + tamper check at restore), then move to final path (same fs = rename; atomic).
6. **DB row**: `status=pending` if no `entityId`; otherwise bind immediately — service validates `entityId` exists in the claimed `entity_type` table (closes the "malicious bind" hole even local).
7. **Image post-process**: rotate-per-EXIF, downscale ≤ 4096 px primary copy, generate thumb (sharp, off the request path via micro queue after commit).
8. Response `{id, url:"/api/files/:id", thumbUrl}`; client adds to entity form; on entity save, action `bindAttachments(ids, entityKind, entityId)` flips to `ready` in same txn as the entity write.

**Serving**: `GET /api/files/:id` → row → provider stream. Headers: `Content-Type: <validated>`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, max-age=31536000, immutable`, `Accept-Ranges: bytes`. `?dl=1` adds `Content-Disposition: attachment`. SVG deliberately excluded from MVP allowlist (embedded-script risk); documented future: sanitize via `svgo`+deny-list or rasterize-on-upload.

## 5. Integrity & lifecycle

| Event | Behavior |
|-------|----------|
| Activity/journal soft delete | attachments stay (restore keeps files) |
| Hard delete entity | attachments marked `orphan`, files deleted by sweep, row kept for 30 d (undo window) then purged |
| Abandoned upload (never bound) | `pending` older than 72 h → sweep deletes |
| Import backup | files restored first, DB rows verified `checksum` spot-sample; mismatch reported |
| Corruption suspicion | `GET /api/health` + settings "Verify storage" action walks rows → provider.head |
| Disk low | upload precheck `free ≥ 2×size` else 507 INSUFFICIENT_STORAGE with message |

## 6. Attachment model (spec fields) — mapping

`id` ✓ · `filename` (safe stored name `{uuid}.jpg`) ✓ · `originalName` ✓ · `mimeType` ✓ (sniffed) · `size` ✓ · `storagePath` ✓ · `entityType` ✓ enum · `entityId` ✓ nullable-until-bind · `createdAt` ✓. Extras: `kind`, `checksum`, `thumbPath`, `status` (each earning its place: preview, verify, perf, lifecycle).

## 7. Settings surface

`/settings/data`: total size (entities vs attachments), per-type counts, top 10 largest, storage provider display, "Verify attachments" action, `attachment_max_bytes` slider, dangerous "delete all attachments + files" (export-first modal, typed confirm).

## 8. Testing seam (chunk 13)

`MemoryStorageProvider` + factory injection makes the pipeline testable without fs: 24 cases incl. polyglot PNG-header-with-JS-chunk, zip-bomb-style truncated stream mid-upload (tmp purge verified), filename `../../../etc/passwd`, `entityId` pointing at wrong type table, 10 MB+1 byte, HEIC (rejected, message suggests convert).
