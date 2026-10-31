import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLE_NAMES,
  backupFileName,
  csvCell,
  deletionOrder,
  isCompatibleBackupVersion,
  isKnownTable,
  SCHEMA_VERSION,
  toCsv,
} from "./backup";

describe("backup contract", () => {
  it("orders tables parents-first and reverses them for deletion", () => {
    expect(BACKUP_TABLE_NAMES.indexOf("categories")).toBeLessThan(BACKUP_TABLE_NAMES.indexOf("activities"));
    expect(BACKUP_TABLE_NAMES.indexOf("goals")).toBeLessThan(BACKUP_TABLE_NAMES.indexOf("milestones"));
    expect(deletionOrder()[0]).toBe("preferences");
    expect(deletionOrder().indexOf("milestones")).toBeLessThan(deletionOrder().indexOf("goals"));
  });

  it("recognises only known tables", () => {
    expect(isKnownTable("activities")).toBe(true);
    expect(isKnownTable("__proto__")).toBe(false);
    expect(isKnownTable("users")).toBe(false);
  });

  it("compares versions", () => {
    expect(isCompatibleBackupVersion(SCHEMA_VERSION)).toBe("same");
    expect(isCompatibleBackupVersion(SCHEMA_VERSION - 1)).toBe("older");
    expect(isCompatibleBackupVersion(SCHEMA_VERSION + 1)).toBe("newer");
  });

  it("builds a dated file name", () => {
    expect(backupFileName("zip", "2026-10-02")).toBe("personal-activity-2026-10-02.zip");
  });
});

describe("csv", () => {
  it("quotes cells containing delimiters, quotes or newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("writes a header from the union of columns and a trailing newline", () => {
    const csv = toCsv([{ a: 1, b: "x" }, { a: 2, c: true }]);
    expect(csv).toBe("a,b,c\r\n1,x,\r\n2,,true\r\n");
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
