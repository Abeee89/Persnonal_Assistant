import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ShortcutProvider } from "@/components/layout/shortcut-provider";
import { loadPreferences } from "@/features/preferences/queries";

export const dynamic = "force-dynamic";

export default function ShellLayout({ children }: { children: ReactNode }) {
  const prefs = loadPreferences();
  return (
    <ShortcutProvider enabled={prefs.shortcutsEnabled}>
      <AppShell density={prefs.density}>{children}</AppShell>
    </ShortcutProvider>
  );
}
