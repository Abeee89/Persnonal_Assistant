import { PageHeader } from "@/components/shared/page-header";
import { SHORTCUTS } from "@/config/shortcuts";
import { ShortcutToggle } from "@/features/preferences/components/shortcut-toggle";
import { loadPreferences } from "@/features/preferences/queries";

export const metadata = { title: "Keyboard shortcuts" };
export const dynamic = "force-dynamic";

export default function ShortcutsPage() {
  const prefs = loadPreferences();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Keyboard shortcuts" description="Shortcuts are fixed for now. You can switch them off entirely." />
      <ShortcutToggle enabled={prefs.shortcutsEnabled} />
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
        {SHORTCUTS.map((action) => (
          <div key={action.id} className="contents">
            <dt>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                {action.combo.replace("Mod", "Ctrl/⌘")}
              </kbd>
            </dt>
            <dd className="text-muted-foreground">{action.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
