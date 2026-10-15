import { PageHeader } from "@/components/shared/page-header";
import { PreferenceForm } from "@/features/preferences/components/preference-form";
import { loadPreferences } from "@/features/preferences/queries";
import { parseEnv } from "@/config/env";

export const metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default function PreferencesPage() {
  const prefs = loadPreferences();
  const serverMaxBytes = parseEnv(process.env).ATTACHMENT_MAX_BYTES;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Preferences" description="Changes apply straight away." />
      <PreferenceForm prefs={prefs} serverMaxBytes={serverMaxBytes} />
    </div>
  );
}
