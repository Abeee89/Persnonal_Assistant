import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedDefaultCategories } from "@/db/seed";
import { activities, attachments, journalTags, journals, tags } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { MemoryStorage } from "@/lib/storage/memory";
import {
  applyImport,
  buildCsvFiles,
  dumpTables,
  exportJson,
  exportCsvZip,
  exportZipArchive,
  parseArchive,
  previewImport,
  rawClient,
} from "./service";

const NOW = "2026-10-14T08:00:00.000Z";
let dir: string;
let handle: DatabaseHandle;
let db: Db;
let storage: MemoryStorage;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-backup-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
  storage = new MemoryStorage();
  seedDefaultCategories(db, () => NOW);
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function seedContent(storage2: MemoryStorage = storage) {
  db.insert(activities)
    .values([
      { id: "a1", title: "Coding", date: "2026-10-14", durationMinutes: 90, createdAt: NOW, updatedAt: NOW },
      { id: "a2", title: "Reading", date: "2026-10-13", createdAt: NOW, updatedAt: NOW },
    ])
    .run();
  db.insert(tags).values({ id: "tg1", name: "focus", slug: "focus", createdAt: NOW }).run();
  db.insert(journals).values({ id: "j1", date: "2026-10-14", type: "daily", contentPlain: "hello", createdAt: NOW, updatedAt: NOW }).run();
  db.insert(journalTags).values({ journalId: "j1", tagId: "tg1" }).run();
  db.insert(attachments)
    .values({
      id: "at1",
      entityType: "journal",
      entityId: "j1",
      filename: "at1.pdf",
      originalName: "scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
      storagePath: "journal/2026/10/at1.pdf",
      kind: "pdf",
      checksum: "x",
      status: "ready",
      createdAt: NOW,
    })
    .run();
  return storage2;
}

describe("export", () => {
  it("dumps every table in a stable order", () => {
    seedContent();
    const tables = dumpTables(rawClient(db));
    expect(Object.keys(tables).slice(0, 3)).toEqual(["categories", "tags", "goals"]);
    expect(tables["activities"]).toHaveLength(2);
  });

  it("produces JSON with the schema version", () => {
    seedContent();
    const parsed = JSON.parse(exportJson(rawClient(db))) as { schemaVersion: number; tables: Record<string, unknown[]> };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tables["activities"]).toHaveLength(2);
  });

  it("produces one CSV file per table", () => {
    seedContent();
    const files = buildCsvFiles(dumpTables(rawClient(db)));
    expect(Object.keys(files)).toContain("activities.csv");
    expect(files["categories.csv"]).toContain("slug");
  });

  it("zipping CSV output yields readable entries", () => {
    seedContent();
    const entries = unzipSync(exportCsvZip(rawClient(db)));
    expect(strFromU8(entries["activities.csv"] ?? new Uint8Array())).toContain("Coding");
  });

  it("builds a ZIP with control files, attachments and a checksum manifest", async () => {
    seedContent();
    await storage.put("journal/2026/10/at1.pdf", new Uint8Array([1, 2, 3, 4, 5]));
    const zip = await exportZipArchive(rawClient(db), storage, NOW);
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toContain("data.json");
    expect(Object.keys(entries)).toContain("metadata.json");
    expect(Object.keys(entries)).toContain("schema-version.json");
    expect(Object.keys(entries)).toContain("manifest.sha256.json");
    expect(Object.keys(entries)).toContain("attachments/journal/2026/10/at1.pdf");
  });
});

describe("round trip", () => {
  it("restores everything after the database is wiped", async () => {
    seedContent();
    await storage.put("journal/2026/10/at1.pdf", new Uint8Array([9, 9, 9]));
    const zip = await exportZipArchive(rawClient(db), storage, NOW);

    const wipe = parseArchive(zip);
    await applyImport(rawClient(db), storage, { ...wipe, envelope: { schemaVersion: 1, tables: emptyTables() } }, "replace");
    expect((rawClient(db).prepare("SELECT count(*) AS n FROM activities").get() as { n: number }).n).toBe(0);

    const freshStorage = new MemoryStorage();
    const parsed = parseArchive(zip);
    const report = await applyImport(rawClient(db), freshStorage, parsed, "replace");
    expect(report.inserted["activities"]).toBe(2);
    expect(report.attachmentsWritten).toBe(1);
    expect((rawClient(db).prepare("SELECT count(*) AS n FROM journal_tags").get() as { n: number }).n).toBe(1);
    expect(await freshStorage.get("journal/2026/10/at1.pdf")).toEqual(new Uint8Array([9, 9, 9]));
  });

  it("merge keeps existing rows and adds only new ones", async () => {
    seedContent();
    const zip = await exportZipArchive(rawClient(db), storage, NOW);
    const parsed = parseArchive(zip);
    const report = await applyImport(rawClient(db), storage, parsed, "merge");
    expect(report.skipped["activities"]).toBe(2);
    expect(report.inserted["activities"]).toBe(0);
    expect((rawClient(db).prepare("SELECT count(*) AS n FROM activities").get() as { n: number }).n).toBe(2);
  });

  it("preview reports incoming and existing counts", () => {
    seedContent();
    const archive = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 1, tables: dumpTables(rawClient(db)) })),
    });
    const preview = previewImport(rawClient(db), parseArchive(archive));
    const activityRow = preview.tables.find((row) => row.table === "activities");
    expect(activityRow).toMatchObject({ incoming: 2, existing: 2 });
  });
});

describe("validation and safety", () => {
  it("rejects a file that is not a zip", () => {
    expect(() => parseArchive(strToU8("not a zip"))).toThrow(AppError);
  });

  it("rejects an archive with a path-traversal entry", () => {
    const evil = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 1, tables: {} })),
      "attachments/../../etc/passwd": strToU8("x"),
    });
    expect(() => parseArchive(evil)).toThrow(/unexpected entry/);
  });

  it("rejects an archive with an unexpected top-level file", () => {
    const evil = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 1, tables: {} })),
      "run-me.sh": strToU8("rm -rf /"),
    });
    expect(() => parseArchive(evil)).toThrow(AppError);
  });

  it("rejects an unknown table in the backup", () => {
    const bad = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 1, tables: { secrets: [{ id: "x" }] } })),
    });
    expect(() => parseArchive(bad)).toThrow(/unknown table/);
  });

  it("refuses a backup from a newer schema version", () => {
    const future = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 99, tables: {} })),
      "schema-version.json": strToU8(JSON.stringify({ version: 99 })),
    });
    expect(() => parseArchive(future)).toThrow(/newer version/);
  });

  it("rejects a tampered archive whose checksum no longer matches", async () => {
    seedContent();
    const zip = await exportZipArchive(rawClient(db), storage, NOW);
    const entries = unzipSync(zip);
    entries["data.json"] = strToU8(JSON.stringify({ schemaVersion: 1, tables: { activities: [{ id: "hacked", title: "x", date: "2026-10-14", created_at: NOW, updated_at: NOW }] } }));
    const tampered = zipSync(entries);
    expect(() => parseArchive(tampered)).toThrow(/checksum/);
  });

  it("reports a row missing its id field", () => {
    const bad = zipSync({
      "data.json": strToU8(JSON.stringify({ schemaVersion: 1, tables: { activities: [{ title: "no id" }] } })),
    });
    expect(() => parseArchive(bad)).toThrow(/missing id/);
  });
});

function emptyTables(): Record<string, Record<string, unknown>[]> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of Object.keys(dumpTables(rawClient(db)))) {
    tables[table] = [];
  }
  return tables;
}
