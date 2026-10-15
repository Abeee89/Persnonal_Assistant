"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MOBILE_NAV, PRIMARY_NAV, UTILITY_NAV, isActivePath, type NavItem } from "@/config/nav";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "@/features/search/components/command-palette";
import { ShortcutHelp } from "./shortcut-help";

const SIDEBAR_KEY = "pa-sidebar-collapsed";

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
        "hover:bg-accent/60 focus-visible:outline-none",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
    </Link>
  );
}

function Sidebar({
  collapsed,
  onToggle,
  pathname,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  return (
    <aside
      aria-label="Primary"
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex",
        "transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        {!collapsed && <span className="truncate font-semibold tracking-tight">Personal Activity</span>}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent",
            collapsed && "ml-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/activities/new"
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90",
            collapsed && "px-0",
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          {collapsed ? <span className="sr-only">Add activity</span> : "Add activity"}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isActivePath(pathname, item.href)}
          />
        ))}
        <div className="my-3 border-t border-border" role="separator" />
        {UTILITY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isActivePath(pathname, item.href)}
          />
        ))}
      </nav>

      <div className={cn("border-t border-border p-3", collapsed && "flex justify-center")}>
        <ThemeToggle compact={collapsed} />
      </div>
    </aside>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {MOBILE_NAV.slice(0, 2).map((item) => (
        <MobileItem key={item.href} item={item} active={isActivePath(pathname, item.href)} />
      ))}
      <div className="flex flex-1 items-center justify-center">
        <Link
          href="/activities/new"
          aria-label="Quick add"
          className="-mt-6 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
        >
          <Plus className="size-6" aria-hidden="true" />
        </Link>
      </div>
      {MOBILE_NAV.slice(2).map((item) => (
        <MobileItem key={item.href} item={item} active={isActivePath(pathname, item.href)} />
      ))}
    </nav>
  );
}

function MobileItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children, density = "comfortable" }: { children: ReactNode; density?: "comfortable" | "compact" }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true");
  }, []);

  const toggle = () => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggle} pathname={pathname} />
      <CommandPalette />
      <ShortcutHelp />
      <div className={cn("flex min-w-0 flex-1 flex-col pb-20 md:pb-0", density === "compact" && "text-[13px] leading-snug [&_.space-y-8]:space-y-5 [&_.py-8]:py-5 [&_.gap-6]:gap-4")} data-density={density}>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>
      <MobileBottomNav pathname={pathname} />
    </div>
  );
}
