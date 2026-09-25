/**
 * The only place amounts convert between integer minor units (what the API
 * stores and sends) and what people read and type. See
 * docs/finance/money-handling.md.
 */

import { getLocale } from "#i18n/locale";

const formatters = new Map<string, Intl.NumberFormat>();

/** One formatter per (language, currency): "£1,204.33" in English, "1.204,33 £" in Vietnamese. */
function formatter(currency: string): Intl.NumberFormat {
  const key = `${getLocale()}|${currency}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(getLocale(), { style: "currency", currency });
    formatters.set(key, fmt);
  }
  return fmt;
}

/** Decimal places in the currency's minor unit: GBP 2, JPY 0, KWD 3. */
export function currencyDigits(currency: string): number {
  return formatter(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** The currency's symbol in the user's locale, e.g. "£". */
export function currencySymbol(currency: string): string {
  return (
    formatter(currency)
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

/**
 * 123433 → "£1,234.33"; negatives keep their sign ("-£40.00"). The currency
 * is required: amounts are only meaningful with it, and a default would
 * hide a mixed-currency bug.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  return formatter(currency).format(amountMinor / 10 ** currencyDigits(currency));
}

/** Like formatMoney, but drops ".00" on whole amounts: "£5,000" rather than "£5,000.00". */
export function formatMoneyShort(amountMinor: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (amountMinor % 10 ** digits !== 0) return formatMoney(amountMinor, currency);
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 10 ** digits);
}

/** The decimal separator people type in the app's language: "." in English, "," in Vietnamese. */
export function decimalSeparator(): string {
  return (
    new Intl.NumberFormat(getLocale()).formatToParts(1.5).find((p) => p.type === "decimal")
      ?.value ?? "."
  );
}

/**
 * Normalises a typed number to "1234.5" form, whichever convention it used.
 * The last "." or "," is the decimal point when 1–`maxFraction` digits
 * follow it; every other separator is grouping. So "12,50" and "12.50" are
 * both 12.5, while "1,204" and "1.204" are both 1204.
 */
function normalizeNumber(input: string, maxFraction: number): string | null {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  if (!/^\d[\d.,]*$|^[.,]\d+$/.test(cleaned)) return null;
  const last = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  const fraction = last === -1 ? "" : cleaned.slice(last + 1);
  const isDecimal = last !== -1 && fraction.length >= 1 && fraction.length <= maxFraction;
  const grouped = isDecimal ? cleaned.slice(0, last) : cleaned;
  // Grouping separators only between thousands: "1,204,500" yes, "1.2.3" no.
  if (/[.,]/.test(grouped) && !/^\d{1,3}([.,]\d{3})+$/.test(grouped)) return null;
  const whole = grouped.replace(/[.,]/g, "");
  return isDecimal ? `${whole || "0"}.${fraction}` : whole;
}

/**
 * What someone typed → minor units, or null if it isn't an amount.
 * Accepts "12.5", "12,50", "£1,204.33", "1.204,33", " 40 ". Signs are the
 * caller's business (an Expense/Income toggle, "I owe"), so a leading minus
 * is rejected.
 */
export function parseMoneyInput(input: string, currency = "GBP"): number | null {
  const digits = currencyDigits(currency);
  // A trailing separator ("12.") is still being typed: read it as whole.
  const normalized = normalizeNumber(input.trim().replace(/[.,]$/, ""), Math.max(digits, 2));
  if (normalized === null || normalized === "") return null;
  const [, fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  return Math.round(Number.parseFloat(normalized) * 10 ** digits);
}

/** Minor units → an editable input value in the app's language: 120433 → "1204.33" / "1204,33". */
export function toMoneyInput(amountMinor: number | null | undefined, currency = "GBP"): string {
  if (amountMinor == null) return "";
  const digits = currencyDigits(currency);
  const value = amountMinor / 10 ** digits;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(digits);
  return text.replace(".", decimalSeparator());
}

/** An empty amount field's hint: "0.00" (Vietnamese "0,00"; "0" for zero-decimal currencies). */
export function moneyPlaceholder(currency = "GBP"): string {
  const digits = currencyDigits(currency);
  return digits > 0 ? `0${decimalSeparator()}${"0".repeat(digits)}` : "0";
}

/** "19.99" or "19,99" → 1999 basis points, or null if blank/invalid. */
export function parsePercentToBps(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (cleaned === "") return null;
  const normalized = normalizeNumber(cleaned, 2);
  if (normalized === null || normalized === "" || !/^\d+(\.\d{1,2})?$/.test(normalized))
    return null;
  return Math.round(Number.parseFloat(normalized) * 100);
}

/** Basis points → an editable percent value: 1999 → "19.99" / "19,99". */
export function toPercentInput(bps: number | null | undefined): string {
  if (bps == null) return "";
  return String(bps / 100).replace(".", decimalSeparator());
}

/** 1999 → "19.99%" (Vietnamese: "19,99%"). */
export function formatBps(bps: number): string {
  return new Intl.NumberFormat(getLocale(), { style: "percent", maximumFractionDigits: 2 }).format(
    bps / 10_000,
  );
}

/** "VND" → "Vietnamese Dong" / "Đồng Việt Nam", in the app's language. */
export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(getLocale(), { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every ISO 4217 currency the runtime knows, for "Add currency". */
export function allCurrencyCodes(): string[] {
  return Intl.supportedValuesOf("currency");
}

/** An exchange rate for reading: 6 significant digits, so 0.0000291 stays readable. */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat(getLocale(), { maximumSignificantDigits: 6 }).format(rate);
}

/**
 * A typed rate → number. Unlike amounts, a rate has no thousands grouping,
 * so the last "." or "," is always the decimal point: "0,0000291" works.
 */
export function parseRateInput(input: string): number | null {
  const cleaned = input.replace(/\s/g, "");
  if (!/^\d*[.,]?\d*$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned.replace(",", "."));
  return value > 0 && Number.isFinite(value) ? value : null;
}
