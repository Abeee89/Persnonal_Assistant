import { parseEnv } from "@/config/env";
import { getDb } from "@/db/runtime";
import { getPreferences, type Preferences } from "./service";

/** Preferences as the UI should see them, with the server attachment ceiling applied. */
export function loadPreferences(): Preferences {
  const env = parseEnv(process.env);
  return getPreferences(getDb(), env.ATTACHMENT_MAX_BYTES);
}
