import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type Database from "better-sqlite3";
import type { Db } from "@/db/client";
import { AppError } from "@/lib/errors";
import { isSafeStorageKey } from "@/lib/files/keys";
import type { StorageProvider } from "@/lib/storage/types";
import {
  BACKUP_TABLES,
  BACKUP_TABLE_NAMES,
  SCHEMA_VERSION,
  backupFileName,
  deletionOrder,
  isCompatibleBackupVersion,
  isKnownTable,
  toCsv,
} from "@/lib/domain/backup";
import {
  backupEnvelopeSchema,
  backupMetadataSchema,
  manifestSchema,
  schemaVersionFileSchema,
  type BackupEnvelope,
  type BackupMetadata,
} from "@/schemas/backup";

export const APP_VERSION = "0.1.0";

const DATA_FILE = "data.json";
const METADATA_FILE = "metadata.json";
const VERSION_FILE = "schema-version.json";
const MANIFEST_FILE = "manifest.sha256.json";
const ATTACHMENT_PREFIX = "attachments/";
const CONTROL_FILES = [DATA_FILE, METADATA_FILE, VERSION_FILE, MANIFEST_FILE];

export type TableDump = Record<string, Record<string, unknown>[]>;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The underlying better-sqlite3 handle, used for bulk reads and writes. */
export function rawClient(db: Db): Database.Database {
  return (db as unknown as { $client: Database.Database }).$client;
}

/** Real column list for a whitelisted table. table_info is only safe because the name is checked first. */
export function tableColumns(client: Database.Database, table: string): string[] {
  if (!isKnownTable(table)) {
    throw new AppError("VALIDATION", `Unknown table: ${table}`);
  }
  const rows = client.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

export function dumpTables(client: Database.Database): TableDump {
  const out: TableDump = {};
  for (const table of BACKUP_TABLE_NAMES) {
    out[table] = client.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  }
  return out;
}

export function countsOf(tables: TableDump): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) {
    counts[name] = rows.length;
  }
  return counts;
}

export function buildEnvelope(client: Database.Database): BackupEnvelope {
  return { schemaVersion: SCHEMA_VERSION, tables: dumpTables(client) };
}

export function exportJson(client: Database.Database): string {
  return JSON.stringify(buildEnvelope(client), null, 2);
}

export function buildCsvFiles(tables: TableDump): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [name, rows] of Object.entries(tables)) {
    files[`${name}.csv`] = toCsv(rows);
  }
  return files;
}

export function exportCsvZip(client: Database.Database): Uint8Array {
  const files = buildCsvFiles(dumpTables(client));
  const encoded: Record<string, Uint8Array> = {};
  for (const [name, csv] of Object.entries(files)) {
    encoded[name] = strToU8(csv);
  }
  return zipSync(encoded, { level: 6 });
}

/** Full ZIP including attachments, plus a checksum manifest over every entry. */
export async function exportZipArchive(
  client: Database.Database,
  storage: StorageProvider,
  now: string,
): Promise<Uint8Array> {
  const tables = dumpTables(client);
  const files: Record<string, Uint8Array> = {
    [DATA_FILE]: strToU8(JSON.stringify({ schemaVersion: SCHEMA_VERSION, tables }, null, 2)),
    [VERSION_FILE]: strToU8(JSON.stringify({ version: SCHEMA_VERSION }, null, 2)),
  };

  let attachmentTotalBytes = 0;
  for (const row of tables["attachments"] ?? []) {
    const path = typeof row["storage_path"] === "string" ? row["storage_path"] : "";
    if (!isSafeStorageKey(path)) {
      continue;
    }
    const bytes = await storage.get(path);
    if (!bytes) {
      continue;
    }
    files[`${ATTACHMENT_PREFIX}${path}`] = bytes;
    attachmentTotalBytes += bytes.byteLength;
  }

  const metadata: BackupMetadata = {
    exportedAt: now,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportFormat: "zip",
    counts: countsOf(tables),
    attachmentTotalBytes,
  };
  files[METADATA_FILE] = strToU8(JSON.stringify(metadata, null, 2));

  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    manifest[name] = sha256(bytes);
  }
  files[MANIFEST_FILE] = strToU8(JSON.stringify(manifest, null, 2));

  return zipSync(files, { level: 6 });
}

export interface ParsedArchive {
  envelope: BackupEnvelope;
  metadata: BackupMetadata | null;
  version: number;
  attachments: Map<string, Uint8Array>;
}

function isAllowedEntry(name: string): boolean {
  if (CONTROL_FILES.includes(name)) {
    return true;
  }
  if (name.startsWith(ATTACHMENT_PREFIX)) {
    return isSafeStorageKey(name.slice(ATTACHMENT_PREFIX.length));
  }
  return false;
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return null;
  }
}

function validateEnvelope(envelope: BackupEnvelope): BackupEnvelope {
  const tables: TableDump = {};
  for (const [table, rows] of Object.entries(envelope.tables)) {
    if (!isKnownTable(table)) {
      throw new AppError("VALIDATION", `The backup contains an unknown table: ${table}`);
    }
    const spec = BACKUP_TABLES.find((entry) => entry.name === table);
    rows.forEach((row, index) => {
      for (const field of spec?.idFields ?? ["id"]) {
        if (typeof row[field] !== "string" || row[field] === "") {
          throw new AppError("VALIDATION", `Row ${String(index)} in ${table} is missing ${field}.`);
        }
      }
    });
    tables[table] = rows;
  }
  for (const required of BACKUP_TABLE_NAMES) {
    tables[required] ??= [];
  }
  return { schemaVersion: envelope.schemaVersion, tables };
}

function verifyManifest(entries: Record<string, Uint8Array>): void {
  const raw = entries[MANIFEST_FILE];
  if (!raw) {
    return;
  }
  const parsed = manifestSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    throw new AppError("VALIDATION", "The archive manifest is unreadable.");
  }
  for (const [name, expected] of Object.entries(parsed.data)) {
    const bytes = entries[name];
    if (!bytes) {
      throw new AppError("VALIDATION", `The archive is missing ${name}.`);
    }
    if (sha256(bytes) !== expected) {
      throw new AppError("VALIDATION", `The file ${name} does not match its checksum; the archive may be corrupted.`);
    }
  }
}

/** Unzips and fully validates an archive before anything is written to the database. */
export function parseArchive(bytes: Uint8Array): ParsedArchive {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new AppError("VALIDATION", "That file is not a valid backup archive.");
  }
  for (const name of Object.keys(entries)) {
    if (!isAllowedEntry(name)) {
      throw new AppError("VALIDATION", `The archive contains an unexpected entry: ${name}`);
    }
  }
  const dataBytes = entries[DATA_FILE];
  if (!dataBytes) {
    throw new AppError("VALIDATION", "The archive is missing data.json.");
  }

  let version = SCHEMA_VERSION;
  if (entries[VERSION_FILE]) {
    const parsed = schemaVersionFileSchema.safeParse(parseJson(entries[VERSION_FILE]));
    if (!parsed.success) {
      throw new AppError("VALIDATION", "The archive has an unreadable schema version.");
    }
    version = parsed.data.version;
  }
  if (isCompatibleBackupVersion(version) === "newer") {
    throw new AppError("VALIDATION", "This backup was made by a newer version of the app. Update the app before restoring it.");
  }

  const envelopeParsed = backupEnvelopeSchema.safeParse(parseJson(dataBytes));
  if (!envelopeParsed.success) {
    throw new AppError("VALIDATION", "The backup data is not in the expected shape.");
  }
  const envelope = validateEnvelope(envelopeParsed.data);

  verifyManifest(entries);

  const attachments = new Map<string, Uint8Array>();
  for (const [name, content] of Object.entries(entries)) {
    if (name.startsWith(ATTACHMENT_PREFIX)) {
      attachments.set(name.slice(ATTACHMENT_PREFIX.length), content);
    }
  }

  let metadata: BackupMetadata | null = null;
  if (entries[METADATA_FILE]) {
    const parsed = backupMetadataSchema.safeParse(parseJson(entries[METADATA_FILE]));
    if (parsed.success) {
      metadata = parsed.data;
    }
  }

  return { envelope, metadata, version, attachments };
}

export interface ImportPreview {
  version: number;
  strategyNote: string;
  tables: { table: string; incoming: number; existing: number }[];
  attachmentsIncoming: number;
}

export function previewImport(client: Database.Database, parsed: ParsedArchive): ImportPreview {
  const tables = BACKUP_TABLE_NAMES.map((table) => ({
    table,
    incoming: parsed.envelope.tables[table]?.length ?? 0,
    existing: (client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number } | undefined)?.n ?? 0,
  }));
  return {
    version: parsed.version,
    strategyNote: "Restoring replaces everything. Merging keeps existing rows and adds only new ones.",
    tables,
    attachmentsIncoming: parsed.attachments.size,
  };
}

export type ImportStrategy = "merge" | "replace";

export interface ImportReport {
  strategy: ImportStrategy;
  inserted: Record<string, number>;
  skipped: Record<string, number>;
  attachmentsWritten: number;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

function insertRows(
  client: Database.Database,
  table: string,
  rows: Record<string, unknown>[],
  mode: ImportStrategy,
): { inserted: number; skipped: number } {
  const columns = tableColumns(client, table);
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const keys = columns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
    if (keys.length === 0) {
      skipped += 1;
      continue;
    }
    const statement = client.prepare(
      `INSERT ${mode === "merge" ? "OR IGNORE " : ""}INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    );
    const result = statement.run(...keys.map((key) => normalizeValue(row[key])));
    if (result.changes === 0) {
      skipped += 1;
    } else {
      inserted += 1;
    }
  }
  return { inserted, skipped };
}

/**
 * Applies an archive. Attachment files are written first, then the database change runs
 * in one transaction, so a failure leaves the database untouched and only harmless orphan
 * files. Merge keeps existing rows and only adds new ones; replace clears everything first.
 */
export async function applyImport(
  client: Database.Database,
  storage: StorageProvider,
  parsed: ParsedArchive,
  strategy: ImportStrategy,
): Promise<ImportReport> {
  let attachmentsWritten = 0;
  for (const [path, bytes] of parsed.attachments) {
    if (!isSafeStorageKey(path)) {
      continue;
    }
    await storage.put(path, bytes);
    attachmentsWritten += 1;
  }

  const inserted: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  try {
    client.transaction(() => {
      if (strategy === "replace") {
        for (const table of deletionOrder()) {
          client.prepare(`DELETE FROM ${table}`).run();
        }
      }
      for (const table of BACKUP_TABLE_NAMES) {
        const result = insertRows(client, table, parsed.envelope.tables[table] ?? [], strategy);
        inserted[table] = result.inserted;
        skipped[table] = result.skipped;
      }
    })();
  } catch (error: unknown) {
    throw new AppError("VALIDATION", "The backup could not be restored. Nothing was changed.", { cause: error });
  }

  return { strategy, inserted, skipped, attachmentsWritten };
}

export { backupFileName, SCHEMA_VERSION };

/**
 * Writes a consistent snapshot of the current database to the auto-backup folder
 * before a destructive restore (SDD §11 §2.3). VACUUM INTO produces a clean,
 * defragmented copy without touching the live connection.
 */
export function createAutoBackup(client: Database.Database, dataDir: string, now: string): string {
  const folder = path.join(path.resolve(dataDir), "backups", "auto");
  fs.mkdirSync(folder, { recursive: true });
  const stamp = now.replace(/[:.]/g, "-");
  const target = path.join(folder, `pre-import-${stamp}.db`);
  client.prepare("VACUUM INTO ?").run(target);
  return target;
}

export interface AutoBackup {
  name: string;
  bytes: number;
  createdAt: string;
}

/** Newest-first list of automatic safety copies. Missing folder means no history yet. */
export function listAutoBackups(dataDir: string): AutoBackup[] {
  const folder = path.join(path.resolve(dataDir), "backups", "auto");
  let names: string[];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".db"))
    .map((name) => {
      const stats = fs.statSync(path.join(folder, name));
      return { name, bytes: stats.size, createdAt: stats.mtime.toISOString() };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
