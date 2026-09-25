import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "#i18n/locale";
import {
  formatBps,
  formatMoney,
  formatMoneyShort,
  parseMoneyInput,
  parsePercentToBps,
  toMoneyInput,
} from "#lib/money";

describe("parseMoneyInput", () => {
  it.each([
    ["12.5", 1250],
    ["£1,204.33", 120433],
    ["0.1", 10],
    ["19.99", 1999],
    [" 40 ", 4000],
  ])("%j → %d", (input, minor) => expect(parseMoneyInput(input)).toBe(minor));

  it.each(["-4", "abc", ".", "", "1.2.3,456"])("rejects %j", (input) =>
    expect(parseMoneyInput(input)).toBeNull(),
  );

  it("reads either decimal convention: the last separator with 1–2 digits after is the point", () => {
    expect(parseMoneyInput("12,50")).toBe(1250);
    expect(parseMoneyInput("12,5")).toBe(1250);
    expect(parseMoneyInput("1.204,33")).toBe(120433);
    expect(parseMoneyInput("1,204")).toBe(120400);
    // Three digits after a single separator is grouping ("1.005" is 1005 in Vietnamese).
    expect(parseMoneyInput("1.005")).toBe(100500);
    // Still being typed.
    expect(parseMoneyInput("12,")).toBe(1200);
  });

  it("uses the currency's minor unit", () => {
    expect(parseMoneyInput("1000", "JPY")).toBe(1000);
    expect(parseMoneyInput("1.5", "JPY")).toBeNull();
  });
});

describe("formatting", () => {
  afterEach(() => setLocale("en-GB"));

  it("uses the app language's separators", () => {
    setLocale("vi-VN");
    expect(toMoneyInput(120433)).toBe("1204,33");
    expect(formatMoney(120433, "GBP")).toMatch(/1\.204,33/);
    expect(parsePercentToBps("6,9")).toBe(690);
    expect(formatBps(1999)).toMatch(/19,99/);
  });

  it("round-trips through the edit field", () => {
    expect(toMoneyInput(120433)).toBe("1204.33");
    expect(toMoneyInput(500000)).toBe("5000");
    expect(toMoneyInput(1250)).toBe("12.50");
  });

  it("drops .00 only when asked", () => {
    expect(formatMoney(500000, "GBP")).toMatch(/5,000\.00/);
    expect(formatMoneyShort(500000, "GBP")).not.toMatch(/\.00/);
  });

  it("converts APRs to basis points and back", () => {
    expect(parsePercentToBps("19.99")).toBe(1999);
    expect(parsePercentToBps("6.9%")).toBe(690);
    expect(parsePercentToBps("")).toBeNull();
    expect(formatBps(1999)).toBe("19.99%");
    expect(formatBps(2000)).toBe("20%");
  });
});
