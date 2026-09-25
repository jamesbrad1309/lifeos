/**
 * Pure budget arithmetic: which limit applies in a month, rollover, pace.
 * No database access, so it can be tested with plain numbers.
 */

/** A budget change: from `month` (YYYY-MM) on, the limit is `amountMinor` (null = none). */
export interface BudgetRule {
  month: string;
  amountMinor: number | null;
  rollover: boolean;
}

/** "2026-09" + n months. */
export function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

/** A rule that sets a limit (rather than ending one). */
type ActiveRule = BudgetRule & { amountMinor: number };

/** The rule in force in `month`: the latest one at or before it. `rules` sorted by month ascending. */
export function ruleFor(rules: BudgetRule[], month: string): ActiveRule | null {
  let found: BudgetRule | null = null;
  for (const rule of rules) {
    if (rule.month > month) break;
    found = rule;
  }
  return found && found.amountMinor !== null ? { ...found, amountMinor: found.amountMinor } : null;
}

/** How far back rollover looks: a bounded window, never a running balance. */
export const ROLLOVER_WINDOW_MONTHS = 12;

export interface BudgetMonth {
  /** This month's own limit. */
  limitMinor: number;
  /** Unspent amount brought forward from last month (0 without rollover). */
  carriedMinor: number;
  /** limit + carried: what can be spent this month. */
  availableMinor: number;
  spentMinor: number;
  /** available − spent; negative when over. */
  remainingMinor: number;
  rollover: boolean;
  /** YYYY-MM the limit was last changed. */
  since: string;
}

/**
 * The budget for `month`, with rollover carried through the months before
 * it (at most ROLLOVER_WINDOW_MONTHS back). Carry never goes negative, so
 * one bad month doesn't eat into every month after it. Returns null when
 * there's no budget in force that month.
 */
export function budgetMonth(
  rules: BudgetRule[],
  spentByMonth: (month: string) => number,
  month: string,
): BudgetMonth | null {
  const current = ruleFor(rules, month);
  if (!current) return null;

  let carried = 0;
  for (let back = ROLLOVER_WINDOW_MONTHS - 1; back >= 1; back--) {
    const m = shiftMonth(month, -back);
    const rule = ruleFor(rules, m);
    if (!rule) {
      carried = 0;
      continue;
    }
    const available = rule.amountMinor + (rule.rollover ? carried : 0);
    carried = Math.max(0, available - spentByMonth(m));
  }

  const carriedMinor = current.rollover ? carried : 0;
  const availableMinor = current.amountMinor + carriedMinor;
  const spentMinor = spentByMonth(month);
  return {
    limitMinor: current.amountMinor,
    carriedMinor,
    availableMinor,
    spentMinor,
    remainingMinor: availableMinor - spentMinor,
    rollover: current.rollover,
    // The rule in force is the latest change at or before `month`.
    since: current.month,
  };
}

/**
 * Share of `month` that has passed on `today` (both the user's calendar):
 * 1 for past months, 0 for future ones.
 */
export function monthProgress(month: string, today: string): number {
  const todayMonth = today.slice(0, 7);
  if (month < todayMonth) return 1;
  if (month > todayMonth) return 0;
  const [y, m, d] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d / days;
}

export type Pace = "on-track" | "close" | "over";

/**
 * Spending against the share of the month gone: at or under pace is on
 * track, up to 15 points ahead is close, beyond that (or over the limit) is
 * over. (docs/finance/budgets-and-reports.md, "Pace colouring".)
 */
export function pace(spentMinor: number, availableMinor: number, progress: number): Pace {
  if (availableMinor <= 0) return spentMinor > 0 ? "over" : "on-track";
  const used = spentMinor / availableMinor;
  if (used > 1) return "over";
  if (used <= progress) return "on-track";
  return used <= progress + 0.15 ? "close" : "over";
}
