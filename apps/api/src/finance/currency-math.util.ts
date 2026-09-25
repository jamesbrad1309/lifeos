/**
 * Pure currency conversion. Rates are stored as units per 1 USD (the
 * providers' pivot), so any pair converts through USD. Amounts are integer
 * minor units, and currencies differ in how many decimals they have (GBP 2,
 * VND 0), so conversion goes through major units.
 */

/** Decimal places of a currency's minor unit: GBP 2, VND 0, KWD 3. */
export function currencyDigits(code: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Per currency, its daily rates (units per 1 USD), oldest first. */
export type RateTable = Map<string, { date: string; perUsd: number }[]>;

/**
 * The rate in force on `date` (YYYY-MM-DD): the latest on or before it.
 * Before the first stored day, the earliest known rate stands in — history
 * older than the first fetch has nothing better. USD is 1 by definition.
 */
export function perUsdOn(table: RateTable, code: string, date: string): number | null {
  if (code === "USD") return 1;
  const days = table.get(code);
  if (!days || days.length === 0) return null;
  let found = days[0].perUsd;
  for (const day of days) {
    if (day.date > date) break;
    found = day.perUsd;
  }
  return found;
}

export interface ConversionContext {
  table: RateTable;
  main: string;
  /** code → main-currency units per 1 unit of `code`, set by the user; wins over fetched rates. */
  overrides: Map<string, number>;
}

/** Main-currency units per 1 unit of `from` on `date`; null when there's no rate to go on. */
export function rateToMain(ctx: ConversionContext, from: string, date: string): number | null {
  if (from === ctx.main) return 1;
  const override = ctx.overrides.get(from);
  if (override) return override;
  const fromPerUsd = perUsdOn(ctx.table, from, date);
  const mainPerUsd = perUsdOn(ctx.table, ctx.main, date);
  return fromPerUsd && mainPerUsd ? mainPerUsd / fromPerUsd : null;
}

/** `minor` units of `from` → minor units of the main currency, or null without a rate. */
export function toMainMinor(
  ctx: ConversionContext,
  minor: number,
  from: string,
  date: string,
): number | null {
  if (from === ctx.main) return minor;
  const rate = rateToMain(ctx, from, date);
  if (rate === null) return null;
  const major = minor / 10 ** currencyDigits(from);
  return Math.round(major * rate * 10 ** currencyDigits(ctx.main));
}
