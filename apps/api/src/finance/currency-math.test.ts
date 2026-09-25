import { describe, expect, it } from "vitest";
import {
  type ConversionContext,
  type RateTable,
  currencyDigits,
  perUsdOn,
  rateToMain,
  toMainMinor,
} from "#finance/currency-math.util";

const table: RateTable = new Map([
  [
    "GBP",
    [
      { date: "2026-08-01", perUsd: 0.8 },
      { date: "2026-09-01", perUsd: 0.75 },
    ],
  ],
  [
    "VND",
    [
      { date: "2026-08-01", perUsd: 25000 },
      { date: "2026-09-01", perUsd: 26000 },
    ],
  ],
]);
const ctx = (over: Partial<ConversionContext> = {}): ConversionContext => ({
  table,
  main: "GBP",
  overrides: new Map(),
  ...over,
});

describe("currencyDigits", () => {
  it("knows each currency's minor unit", () => {
    expect(currencyDigits("GBP")).toBe(2);
    expect(currencyDigits("VND")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
  });
});

describe("perUsdOn", () => {
  it("uses the latest rate on or before the date", () => {
    expect(perUsdOn(table, "GBP", "2026-08-31")).toBe(0.8);
    expect(perUsdOn(table, "GBP", "2026-09-01")).toBe(0.75);
    expect(perUsdOn(table, "GBP", "2027-01-01")).toBe(0.75);
  });
  it("falls back to the earliest rate before the first stored day", () => {
    expect(perUsdOn(table, "GBP", "2020-01-01")).toBe(0.8);
  });
  it("USD is always 1; unknown currencies have no rate", () => {
    expect(perUsdOn(table, "USD", "2026-09-01")).toBe(1);
    expect(perUsdOn(table, "JPY", "2026-09-01")).toBeNull();
  });
});

describe("toMainMinor", () => {
  it("converts through USD, respecting decimal places", () => {
    // ₫2,600,000 in September: 100 USD = £75.00.
    expect(toMainMinor(ctx(), 2_600_000, "VND", "2026-09-15")).toBe(7500);
    // £75.00 → VND with VND as main: 100 USD = ₫2,600,000 (no decimals).
    expect(toMainMinor(ctx({ main: "VND" }), 7500, "GBP", "2026-09-15")).toBe(2_600_000);
  });
  it("uses the rate of the date, not today's", () => {
    // August: 25,000 VND per USD, 0.8 GBP per USD → ₫2,500,000 = £80.00.
    expect(toMainMinor(ctx(), 2_500_000, "VND", "2026-08-20")).toBe(8000);
  });
  it("the main currency passes through unchanged", () => {
    expect(toMainMinor(ctx(), 1234, "GBP", "2026-09-01")).toBe(1234);
  });
  it("a user's override wins over fetched rates", () => {
    const withOverride = ctx({ overrides: new Map([["VND", 0.00003]]) });
    expect(rateToMain(withOverride, "VND", "2026-09-01")).toBe(0.00003);
    expect(toMainMinor(withOverride, 1_000_000, "VND", "2026-09-01")).toBe(3000);
  });
  it("is null without a rate, so callers can report it instead of guessing", () => {
    expect(toMainMinor(ctx(), 100, "JPY", "2026-09-01")).toBeNull();
  });
});
