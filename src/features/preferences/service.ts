import { eq } from "drizzle-orm";
import type { Db, DbExec } from "@/db/client";
import { preferences } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { PREFERENCE_KEYS, preferenceSchemaFor, type PreferenceKey } from "@/schemas/preference";

export interface Preferences {
  displayName: string | null;
  weekStart: 0 | 1;
  density: "comfortable" | "compact";
  shortcutsEnabled: boolean;
  attachmentMaxBytes: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  displayName: null,
  weekStart: 1,
  density: "comfortable",
  shortcutsEnabled: true,
  attachmentMaxBytes: 10 * 1024 * 1024,
};

/**
 * Reads every preference with its default. A row that fails validation (for example
 * after a manual database edit) is ignored and the default is used, so one bad value
 * cannot stop the whole app from loading.
 */
export function getPreferences(db: DbExec, serverMaxBytes: number = Number.POSITIVE_INFINITY): Preferences {
  const rows = db.select().from(preferences).all();
  const stored: Partial<Record<PreferenceKey, unknown>> = {};
  for (const row of rows) {
    const schema = preferenceSchemaFor(row.key);
    if (!schema) {
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(row.value);
    } catch {
      continue;
    }
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      stored[row.key as PreferenceKey] = parsed.data;
    }
  }
  const merged: Preferences = { ...DEFAULT_PREFERENCES, ...stored } as Preferences;
  return {
    ...merged,
    displayName: merged.displayName === "" ? null : merged.displayName,
    attachmentMaxBytes: Math.min(merged.attachmentMaxBytes, serverMaxBytes),
  };
}

export function setPreference(
  db: Db,
  key: string,
  value: unknown,
  now: () => string = () => new Date().toISOString(),
): void {
  const schema = preferenceSchemaFor(key);
  if (!schema) {
    throw new AppError("VALIDATION", "Unknown preference.", { fieldErrors: { key: ["Unknown preference."] } });
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
      fieldErrors: { value: parsed.error.issues.map((issue) => issue.message) },
    });
  }
  db.insert(preferences)
    .values({ key, value: JSON.stringify(parsed.data), updatedAt: now() })
    .onConflictDoUpdate({
      target: preferences.key,
      set: { value: JSON.stringify(parsed.data), updatedAt: now() },
    })
    .run();
}

export function resetPreference(db: Db, key: string): void {
  if (!(PREFERENCE_KEYS as string[]).includes(key)) {
    throw new AppError("VALIDATION", "Unknown preference.", { fieldErrors: { key: ["Unknown preference."] } });
  }
  db.delete(preferences).where(eq(preferences.key, key)).run();
}
