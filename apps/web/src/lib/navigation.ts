import {
  CalendarClock,
  ChartBar,
  Coins,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  PiggyBank,
  Receipt,
} from "lucide-react";
import type { shell } from "#i18n/en/shell";
import type { FileRouteTypes } from "../routeTree.gen";

/** A `shell.nav` key naming a menu item. */
type NavLabel = Exclude<
  keyof typeof shell.nav,
  "groups" | "comingSoonItem" | "toReview" | "mainLabel"
>;

/**
 * Sidebar entries. Page titles live on the routes themselves
 * (`staticData` in `src/routes/`); this only decides what's in the menu.
 */
export interface NavItem {
  /** Translated through `shell.nav.<label>`. */
  label: NavLabel;
  icon: LucideIcon;
  /** A real route path: a typo or a renamed route is a type error. */
  to: FileRouteTypes["to"];
  /** Active only on this exact path, not its children (for section index pages). */
  exact?: boolean;
  /** A live count next to the label: "toReview" is finance's uncategorised inbox. */
  badge?: "toReview";
}

export interface NavGroup {
  /** Translated through `shell.nav.groups.<label>`. */
  label: keyof typeof shell.nav.groups;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "habits",
    items: [
      { label: "dashboard", icon: LayoutDashboard, to: "/habits", exact: true },
      { label: "today", icon: CalendarClock, to: "/habits/today" },
    ],
  },
  {
    label: "mind",
    items: [{ label: "journal", icon: NotebookPen, to: "/journal" }],
  },
  {
    label: "money",
    items: [
      { label: "accounts", icon: Landmark, to: "/finance/accounts" },
      { label: "transactions", icon: Receipt, to: "/finance/transactions", badge: "toReview" },
      { label: "spending", icon: ChartBar, to: "/finance/spending" },
      { label: "budgets", icon: PiggyBank, to: "/finance/budgets" },
      { label: "currencies", icon: Coins, to: "/finance/currencies" },
    ],
  },
];

/** Planned screens, shown greyed out in the sidebar (see docs/finance/index.md). */
export const COMING_SOON: { label: NavLabel; icon: LucideIcon }[] = [];
