import { CalendarClock, LayoutDashboard, type LucideIcon, NotebookPen, Wallet } from "lucide-react";

export type ViewId = "dashboard" | "today" | "journal";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  /** App bar heading and subheading while this view is open. */
  title: string;
  subtitle: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Habits",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        title: "Dashboard",
        subtitle: "Keep your streaks alive.",
      },
      {
        id: "today",
        label: "Today",
        icon: CalendarClock,
        title: "Today",
        subtitle: "What's due, hour by hour.",
      },
    ],
  },
  {
    label: "Mind",
    items: [
      {
        id: "journal",
        label: "Journal",
        icon: NotebookPen,
        title: "Journal",
        subtitle: "What you did, felt, and what happened.",
      },
    ],
  },
];

/** Planned modules, shown greyed out in the sidebar (see docs/finance). */
export const COMING_SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Finance", icon: Wallet },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function isViewId(value: string): value is ViewId {
  return NAV_ITEMS.some((item) => item.id === value);
}

export function hrefFor(view: ViewId): string {
  return `#/${view}`;
}
