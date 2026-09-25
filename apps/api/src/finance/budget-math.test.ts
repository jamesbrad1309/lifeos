import { describe, expect, it } from "vitest";
import {
  type BudgetRule,
  budgetMonth,
  monthProgress,
  pace,
  ruleFor,
  shiftMonth,
} from "#finance/budget-math.util";

const spending = (byMonth: Record<string, number>) => (m: string) => byMonth[m] ?? 0;

describe("ruleFor: budgets carry forward", () => {
  const rules: BudgetRule[] = [
    { month: "2026-03", amountMinor: 20000, rollover: false },
    { month: "2026-06", amountMinor: 30000, rollover: false },
    { month: "2026-09", amountMinor: null, rollover: false },
  ];

  it.each([
    ["2026-02", null],
    ["2026-03", 20000],
    ["2026-05", 20000],
    ["2026-06", 30000],
    ["2026-08", 30000],
    ["2026-09", null],
    ["2027-01", null],
  ])("%s → %s", (month, amount) => {
    expect(ruleFor(rules, month)?.amountMinor ?? null).toBe(amount);
  });
});

describe("budgetMonth", () => {
  it("is null with no budget in force", () => {
    expect(budgetMonth([], spending({}), "2026-09")).toBeNull();
  });

  it("without rollover, each month starts fresh", () => {
    const rules = [{ month: "2026-01", amountMinor: 10000, rollover: false }];
    const b = budgetMonth(rules, spending({ "2026-08": 2000, "2026-09": 4000 }), "2026-09");
    expect(b).toMatchObject({
      limitMinor: 10000,
      carriedMinor: 0,
      availableMinor: 10000,
      spentMinor: 4000,
      remainingMinor: 6000,
      since: "2026-01",
    });
  });

  it("with rollover, unspent money carries and accumulates", () => {
    const rules = [{ month: "2026-07", amountMinor: 10000, rollover: true }];
    // July: 10000 − 7000 = 3000 carried; August: 13000 − 12000 = 1000 carried.
    const b = budgetMonth(
      rules,
      spending({ "2026-07": 7000, "2026-08": 12000, "2026-09": 500 }),
      "2026-09",
    );
    expect(b).toMatchObject({ carriedMinor: 1000, availableMinor: 11000, remainingMinor: 10500 });
  });

  it("an overspend never carries as a debt", () => {
    const rules = [{ month: "2026-07", amountMinor: 10000, rollover: true }];
    const b = budgetMonth(rules, spending({ "2026-08": 25000 }), "2026-09");
    expect(b?.carriedMinor).toBe(0);
    expect(b?.availableMinor).toBe(10000);
  });

  it("a gap with no budget resets the carry", () => {
    const rules = [
      { month: "2026-05", amountMinor: 10000, rollover: true },
      { month: "2026-07", amountMinor: null, rollover: false },
      { month: "2026-08", amountMinor: 10000, rollover: true },
    ];
    // May and June would carry 20000, but July had no budget.
    expect(budgetMonth(rules, spending({ "2026-08": 4000 }), "2026-09")?.carriedMinor).toBe(6000);
  });

  it("looks back at most 12 months", () => {
    const rules = [{ month: "2020-01", amountMinor: 1000, rollover: true }];
    // 11 earlier months in the window, each fully unspent.
    expect(budgetMonth(rules, spending({}), "2026-09")?.carriedMinor).toBe(11000);
  });

  it("refunds (negative net spend) count in its favour", () => {
    const rules = [{ month: "2026-09", amountMinor: 5000, rollover: false }];
    expect(budgetMonth(rules, spending({ "2026-09": -1200 }), "2026-09")?.remainingMinor).toBe(
      6200,
    );
  });
});

describe("monthProgress", () => {
  it.each([
    ["2026-08", "2026-09-25", 1],
    ["2026-10", "2026-09-25", 0],
    ["2026-09", "2026-09-15", 0.5],
    ["2026-02", "2026-02-28", 1],
  ])("%s on %s → %s", (month, today, expected) => {
    expect(monthProgress(month, today)).toBeCloseTo(expected);
  });
});

describe("pace", () => {
  it.each([
    [4000, 10000, 0.5, "on-track"],
    [5000, 10000, 0.5, "on-track"],
    [6000, 10000, 0.5, "close"],
    [6500, 10000, 0.5, "close"],
    [6600, 10000, 0.5, "over"],
    [10500, 10000, 1, "over"],
    [0, 0, 0.5, "on-track"],
  ] as const)("spent %d of %d at %s → %s", (spent, available, progress, expected) => {
    expect(pace(spent, available, progress)).toBe(expected);
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", -11)).toBe("2025-10");
  });
});
