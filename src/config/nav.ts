import {
  BarChart3,
  CalendarDays,
  Activity,
  BookOpen,
  CheckSquare,
  Flag,
  Home,
  Repeat,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Today", href: "/today", icon: Sun },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Activities", href: "/activities", icon: Activity },
  { label: "Journal", href: "/journal", icon: BookOpen },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Goals", href: "/goals", icon: Flag },
  { label: "Habits", href: "/habits", icon: Repeat },
  { label: "Statistics", href: "/statistics", icon: BarChart3 },
];

export const UTILITY_NAV: readonly NavItem[] = [
  { label: "Search", href: "/search", icon: Search },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_NAV: readonly NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Today", href: "/today", icon: Sun },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
