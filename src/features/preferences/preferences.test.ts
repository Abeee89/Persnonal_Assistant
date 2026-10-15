import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db, type DatabaseHandle } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { preferences } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { DEFAULT_PREFERENCES, getPreferences, resetPreference, setPreference } from "./service";

let dir: string;
let handle: DatabaseHandle;
let db: Db;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-pref-"));
  handle = openDatabase({ file: path.join(dir, "t.db") });
  runMigrations(handle.db);
  db = handle.db;
});

afterEach(() => {
  handle.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = () => "2026-10-14T08:00:00.000Z";

describe("getPreferences", () => {
  it("returns defaults on a fresh database", () => {
    expect(getPreferences(db)).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns stored values over defaults", () => {
    setPreference(db, "displayName", "Raka", NOW);
    setPreference(db, "density", "compact", NOW);
    const prefs = getPreferences(db);
    expect(prefs.displayName).toBe("Raka");
    expect(prefs.density).toBe("compact");
    expect(prefs.weekStart).toBe(1);
  });

  it("ignores a corrupt row and falls back to its default", () => {
    db.insert(preferences).values({ key: "density", value: "{not json", updatedAt: NOW() }).run();
    db.insert(preferences).values({ key: "weekStart", value: JSON.stringify(9), updatedAt: NOW() }).run();
    const prefs = getPreferences(db);
    expect(prefs.density).toBe("comfortable");
    expect(prefs.weekStart).toBe(1);
  });

  it("ignores rows for keys that are no longer supported (such as a removed theme key)", () => {
    db.insert(preferences).values({ key: "theme", value: JSON.stringify("dark"), updatedAt: NOW() }).run();
    expect(getPreferences(db)).toEqual(DEFAULT_PREFERENCES);
  });

  it("clamps the attachment cap to the server ceiling", () => {
    setPreference(db, "attachmentMaxBytes", 40 * 1024 * 1024, NOW);
    expect(getPreferences(db, 10 * 1024 * 1024).attachmentMaxBytes).toBe(10 * 1024 * 1024);
  });

  it("treats an empty display name as not set", () => {
    db.insert(preferences).values({ key: "displayName", value: JSON.stringify(""), updatedAt: NOW() }).run();
    expect(getPreferences(db).displayName).toBeNull();
  });
});

describe("setPreference", () => {
  it("upserts one row per key", () => {
    setPreference(db, "density", "compact", NOW);
    setPreference(db, "density", "comfortable", NOW);
    const rows = db.select().from(preferences).all();
    expect(rows).toHaveLength(1);
    expect(getPreferences(db).density).toBe("comfortable");
  });

  it("rejects unknown keys", () => {
    expect(() => {
      setPreference(db, "isAdmin", true, NOW);
    }).toThrow(AppError);
    expect(() => {
      setPreference(db, "__proto__", true, NOW);
    }).toThrow(AppError);
  });

  it("rejects invalid values with a field error", () => {
    try {
      setPreference(db, "weekStart", 3, NOW);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).fieldErrors).toHaveProperty("value");
    }
  });

  it("rejects an oversized display name", () => {
    expect(() => {
      setPreference(db, "displayName", "x".repeat(61), NOW);
    }).toThrow(AppError);
  });
});

describe("preferences drive the app", () => {
  it("a saved display name is what the dashboard greets the user with", () => {
    setPreference(db, "displayName", "Raka", NOW);
    expect(getPreferences(db).displayName).toBe("Raka");
  });

  it("a saved week start changes the first day of the calendar grid", async () => {
    const { monthGrid } = await import("@/lib/domain/calendar");
    setPreference(db, "weekStart", 0, NOW);
    expect(monthGrid("2026-10-15", getPreferences(db).weekStart)[0]).toBe("2026-09-27");
    setPreference(db, "weekStart", 1, NOW);
    expect(monthGrid("2026-10-15", getPreferences(db).weekStart)[0]).toBe("2026-09-28");
  });

  it("a saved attachment cap below the server ceiling is what upload enforces", () => {
    setPreference(db, "attachmentMaxBytes", 2 * 1024 * 1024, NOW);
    expect(getPreferences(db, 10 * 1024 * 1024).attachmentMaxBytes).toBe(2 * 1024 * 1024);
  });

  it("turning shortcuts off is persisted and read back", () => {
    setPreference(db, "shortcutsEnabled", false, NOW);
    expect(getPreferences(db).shortcutsEnabled).toBe(false);
  });
});

describe("resetPreference", () => {
  it("removes a stored value so the default applies again", () => {
    setPreference(db, "density", "compact", NOW);
    resetPreference(db, "density");
    expect(getPreferences(db).density).toBe("comfortable");
  });

  it("rejects unknown keys", () => {
    expect(() => {
      resetPreference(db, "nope");
    }).toThrow(AppError);
  });
});
