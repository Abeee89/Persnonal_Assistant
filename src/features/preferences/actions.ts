"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/runtime";
import { defineAction } from "@/lib/action";
import { preferenceSetSchema, PREFERENCE_KEYS } from "@/schemas/preference";
import type { ActionResult } from "@/types/result";
import { resetPreference, setPreference } from "./service";

function revalidateAll(): void {
  for (const path of ["/", "/today", "/calendar", "/settings", "/settings/preferences", "/settings/shortcuts"]) {
    revalidatePath(path);
  }
}

const setHandler = defineAction("preference.set", preferenceSetSchema, ({ key, value }): { key: string } => {
  setPreference(getDb(), key, value);
  revalidateAll();
  return { key };
});

const resetHandler = defineAction(
  "preference.reset",
  z.object({ key: z.enum(PREFERENCE_KEYS as [string, ...string[]]) }),
  ({ key }): { key: string } => {
    resetPreference(getDb(), key);
    revalidateAll();
    return { key };
  },
);

export async function setPreferenceAction(raw: unknown): Promise<ActionResult<{ key: string }>> {
  return setHandler(raw);
}

export async function resetPreferenceAction(raw: unknown): Promise<ActionResult<{ key: string }>> {
  return resetHandler(raw);
}
