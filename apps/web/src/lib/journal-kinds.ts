import { CalendarDays, Heart, type LucideIcon, Zap } from "lucide-react";
import type { JournalEntryKind } from "#graphql/types";

/** A journal kind's look and shortcut; its words are `journal.kinds.<KIND>` translations. */
export interface KindConfig {
  kind: JournalEntryKind;
  /** Keyboard shortcut (when no input is focused) that switches the composer to this kind. */
  shortcut: string;
  icon: LucideIcon;
  /** Tailwind classes: selected switch / chip, and the timeline dot. */
  activeClass: string;
  dotClass: string;
}

export const KINDS: KindConfig[] = [
  {
    kind: "ACTION",
    shortcut: "d",
    icon: Zap,
    activeClass: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500 text-white",
  },
  {
    kind: "FEELING",
    shortcut: "f",
    icon: Heart,
    activeClass: "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dotClass: "bg-violet-500 text-white",
  },
  {
    kind: "EVENT",
    shortcut: "h",
    icon: CalendarDays,
    activeClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500 text-white",
  },
];

export const KIND_BY_ID = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<
  JournalEntryKind,
  KindConfig
>;
