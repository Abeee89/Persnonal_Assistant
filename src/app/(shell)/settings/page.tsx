import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { loadPreferences } from "@/features/preferences/queries";
import { SHORTCUTS } from "@/config/shortcuts";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/settings/preferences", title: "Preferences", text: "Name, week start, density and attachment size." },
  { href: "/settings/shortcuts", title: "Keyboard shortcuts", text: "Turn shortcuts on or off and see the list." },
  { href: "/settings/data", title: "Your data", text: "Where your data lives and how much space it uses." },
];

export default function SettingsPage() {
  const prefs = loadPreferences();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader title="Settings" description="Everything here stays on this device." />
      <ul className="grid gap-3">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="block rounded-lg border border-border bg-surface p-4 hover:bg-accent/40">
              <p className="font-medium">{section.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{section.text}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        {prefs.shortcutsEnabled ? `${String(SHORTCUTS.length)} keyboard shortcuts active.` : "Keyboard shortcuts are off."}
      </p>
    </div>
  );
}
