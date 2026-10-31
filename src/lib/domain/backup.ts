/**
 * Backup contract (SDD §11 §2). The archive is the unit of trust: it is what a user
 * copies to another machine, so its shape is versioned and validated on import.
 * Bumping SCHEMA_VERSION means an older app must refuse the file rather than guess.
 */
export const SCHEMA_VERSION = 1;

export type TableKind = "entity" | "junction";

export interface BackupTable {
  name: string;
  kind: TableKind;
  /** Columns that must be present on every row of this table. */
  idFields: readonly string[];
}

/** Parents appear before children, so an ordered insert never violates a foreign key. */
export const BACKUP_TABLES: readonly BackupTable[] = [
  { name: "categories", kind: "entity", idFields: ["id"] },
  { name: "tags", kind: "entity", idFields: ["id"] },
  { name: "goals", kind: "entity", idFields: ["id"] },
  { name: "milestones", kind: "entity", idFields: ["id"] },
  { name: "activities", kind: "entity", idFields: ["id"] },
  { name: "tasks", kind: "entity", idFields: ["id"] },
  { name: "journals", kind: "entity", idFields: ["id"] },
  { name: "habits", kind: "entity", idFields: ["id"] },
  { name: "habit_logs", kind: "entity", idFields: ["id"] },
  { name: "activity_tags", kind: "junction", idFields: ["activity_id", "tag_id"] },
  { name: "journal_tags", kind: "junction", idFields: ["journal_id", "tag_id"] },
  { name: "task_tags", kind: "junction", idFields: ["task_id", "tag_id"] },
  { name: "goal_tags", kind: "junction", idFields: ["goal_id", "tag_id"] },
  { name: "attachments", kind: "entity", idFields: ["id"] },
  { name: "preferences", kind: "entity", idFields: ["key"] },
];

export const BACKUP_TABLE_NAMES = BACKUP_TABLES.map((table) => table.name);

/** Reverse order for deleting everything before a replace-style restore. */
export function deletionOrder(): string[] {
  return [...BACKUP_TABLE_NAMES].reverse();
}

export function isKnownTable(name: string): boolean {
  return BACKUP_TABLE_NAMES.includes(name);
}

export function isCompatibleBackupVersion(version: number, current = SCHEMA_VERSION): "same" | "older" | "newer" {
  if (version === current) {
    return "same";
  }
  return version < current ? "older" : "newer";
}

/** One CSV cell: quoted when it contains a delimiter, quote or newline, with quotes doubled. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    text = value.toString();
  } else {
    text = JSON.stringify(value);
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Header row plus one row per record, CRLF line endings and a trailing newline. */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Stable, dependency-free export file name, for example personal-activity-2026-10-02.zip. */
export function backupFileName(extension: string, day: string): string {
  return `personal-activity-${day}.${extension}`;
}
