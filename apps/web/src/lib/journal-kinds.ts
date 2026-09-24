import { CalendarDays, Heart, type LucideIcon, Zap } from "lucide-react";
import type { JournalEntryKind } from "#graphql/types";

export interface KindConfig {
  kind: JournalEntryKind;
  /** Short verb used on the composer's kind switch and filter chips. */
  label: string;
  /** Keyboard shortcut (when no input is focused) that switches the composer to this kind. */
  shortcut: string;
  icon: LucideIcon;
  placeholder: string;
  /** Tailwind classes: selected switch / chip, and the timeline dot. */
  activeClass: string;
  dotClass: string;
}

export const KINDS: KindConfig[] = [
  {
    kind: "ACTION",
    label: "Did",
    shortcut: "d",
    icon: Zap,
    placeholder: "What did you do?",
    activeClass: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500 text-white",
  },
  {
    kind: "FEELING",
    label: "Felt",
    shortcut: "f",
    icon: Heart,
    placeholder: "What's behind it? (optional)",
    activeClass: "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dotClass: "bg-violet-500 text-white",
  },
  {
    kind: "EVENT",
    label: "Happened",
    shortcut: "h",
    icon: CalendarDays,
    placeholder: "What happened?",
    activeClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500 text-white",
  },
];

export const KIND_BY_ID = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<
  JournalEntryKind,
  KindConfig
>;
