import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

/** Text colours for money in and out; contrast-checked on both themes' cards. */
export const MONEY_IN_CLASS = "text-emerald-600 dark:text-emerald-400";
export const MONEY_OUT_CLASS = "text-rose-600 dark:text-rose-400";

/** The tone of a signed amount: gains green, losses red, zero plain. */
export function moneyToneClass(amountMinor: number): string | undefined {
  if (amountMinor > 0) return MONEY_IN_CLASS;
  if (amountMinor < 0) return MONEY_OUT_CLASS;
  return undefined;
}

interface Props {
  /** Signed minor units: positive = money in, negative = money out. */
  minor: number;
  currency: string;
  /**
   * "neutral" for money that only moved between your own accounts (a
   * transfer): it's neither a gain nor a loss, so it keeps its sign but no colour.
   */
  tone?: "auto" | "neutral";
  className?: string;
}

/**
 * A signed amount: "+£12.50" in green for money in, "−£12.50" in red for
 * money out. The sign is always shown, so the meaning never rests on colour
 * alone.
 */
export function Amount({ minor, currency, tone = "auto", className }: Props) {
  const sign = minor > 0 ? "+" : minor < 0 ? "−" : "";
  return (
    <span className={cn("tabular-nums", tone === "auto" && moneyToneClass(minor), className)}>
      {sign}
      {formatMoney(Math.abs(minor), currency)}
    </span>
  );
}
