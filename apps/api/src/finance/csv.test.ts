import { describe, expect, it } from "vitest";
import {
  applyMapping,
  guessDateFormat,
  guessMapping,
  parseCsvDate,
  parseSignedAmount,
} from "#finance/csv.util";

describe("parseCsvDate", () => {
  it.each([
    ["31/12/2026", "DD/MM/YYYY", "2026-12-31"],
    ["12/31/2026", "MM/DD/YYYY", "2026-12-31"],
    ["2026-12-31", "YYYY-MM-DD", "2026-12-31"],
    ["31.12.2026", "DD.MM.YYYY", "2026-12-31"],
    ["3/4/26", "DD/MM/YYYY", "2026-04-03"],
    ["31/02/2026", "DD/MM/YYYY", null],
    ["12/31/2026", "DD/MM/YYYY", null],
    ["", "DD/MM/YYYY", null],
  ] as const)("%s as %s → %s", (text, format, expected) => {
    expect(parseCsvDate(text, format)).toBe(expected);
  });
});

describe("parseSignedAmount", () => {
  it.each([
    ["-12.50", -1250],
    ["12.50", 1250],
    ["(12.50)", -1250],
    ["12.50-", -1250],
    ["£1,234.50", 123450],
    ["-£3.40", -340],
    ["+2,500.00", 250000],
    ["12.50 DR", -1250],
    ["12.50 CR", 1250],
    ["", null],
    ["n/a", null],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseSignedAmount(text, "GBP")).toBe(expected);
  });

  it("reads VND with dots as thousands", () => {
    expect(parseSignedAmount("1.500.000", "VND")).toBe(1_500_000);
    expect(parseSignedAmount("-45.000", "VND")).toBe(-45_000);
  });
});

describe("guessDateFormat", () => {
  it("a day above 12 settles the order", () => {
    expect(guessDateFormat(["03/04/2026", "25/04/2026"])).toBe("DD/MM/YYYY");
    expect(guessDateFormat(["04/03/2026", "04/25/2026"])).toBe("MM/DD/YYYY");
  });
  it("ambiguous dates follow the preference", () => {
    expect(guessDateFormat(["03/04/2026"], true)).toBe("DD/MM/YYYY");
    expect(guessDateFormat(["03/04/2026"], false)).toBe("MM/DD/YYYY");
    expect(guessDateFormat(["2026-04-03"])).toBe("YYYY-MM-DD");
    expect(guessDateFormat(["03.04.2026"])).toBe("DD.MM.YYYY");
  });
});

describe("guessMapping + applyMapping on real-looking exports", () => {
  it("single signed amount column (Monzo-style)", () => {
    const records = [
      ["Date", "Name", "Category", "Amount", "Notes"],
      ["2026-09-02", "Tesco", "Groceries", "-23.10", ""],
      ["2026-09-10", "ACME Ltd", "Income", "2500.00", "Salary"],
    ];
    const mapping = guessMapping(records);
    expect(mapping).toMatchObject({
      hasHeader: true,
      dateColumn: 0,
      dateFormat: "YYYY-MM-DD",
      amount: { mode: "single", column: 3 },
      payeeColumn: 1,
      noteColumn: 4,
    });
    const { rows, problems } = applyMapping(records, mapping, "GBP");
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { line: 2, date: "2026-09-02", amountMinor: -2310, payee: "Tesco", note: null },
      { line: 3, date: "2026-09-10", amountMinor: 250000, payee: "ACME Ltd", note: "Salary" },
    ]);
  });

  it("separate paid out / paid in columns (Nationwide-style)", () => {
    const records = [
      ["Date", "Transaction type", "Description", "Paid out", "Paid in", "Balance"],
      ["05/09/2026", "Card", "PRET A MANGER", "£3.50", "", "£996.50"],
      ["15/09/2026", "Transfer", "REFUND", "", "£20.00", "£1016.50"],
    ];
    const mapping = guessMapping(records);
    expect(mapping.amount).toEqual({ mode: "split", debitColumn: 3, creditColumn: 4 });
    expect(mapping.payeeColumn).toBe(2);
    expect(applyMapping(records, mapping, "GBP").rows.map((r) => [r.date, r.amountMinor])).toEqual([
      ["2026-09-05", -350],
      ["2026-09-15", 2000],
    ]);
  });

  it("US month-first dates", () => {
    const records = [
      ["Posting Date", "Description", "Amount"],
      ["09/25/2026", "STARBUCKS", "-5.45"],
    ];
    const mapping = guessMapping(records);
    expect(mapping.dateFormat).toBe("MM/DD/YYYY");
    expect(applyMapping(records, mapping, "USD").rows[0].date).toBe("2026-09-25");
  });

  it("Vietnamese bank export (Ngày / Nội dung / Ghi nợ / Ghi có, VND)", () => {
    const records = [
      ["STT", "Ngày giao dịch", "Nội dung", "Ghi nợ", "Ghi có", "Số dư"],
      ["1", "03/09/2026", "Thanh toan Highlands Coffee", "45.000", "", "1.455.000"],
      ["2", "25/09/2026", "Luong thang 9", "", "15.000.000", "16.455.000"],
    ];
    const mapping = guessMapping(records);
    expect(mapping).toMatchObject({
      dateColumn: 1,
      dateFormat: "DD/MM/YYYY",
      amount: { mode: "split", debitColumn: 3, creditColumn: 4 },
      payeeColumn: 2,
    });
    expect(applyMapping(records, mapping, "VND").rows.map((r) => r.amountMinor)).toEqual([
      -45_000, 15_000_000,
    ]);
  });

  it("reports unreadable lines instead of guessing, and skips blank ones", () => {
    const records = [
      ["Date", "Description", "Amount"],
      ["31/02/2026", "Bad date", "-1.00"],
      ["01/09/2026", "Bad amount", "n/a"],
      ["", "", ""],
    ];
    const { rows, problems } = applyMapping(records, guessMapping(records), "GBP");
    expect(rows).toEqual([]);
    expect(problems.map((p) => [p.line, p.reason])).toEqual([
      [2, "date"],
      [3, "amount"],
    ]);
  });

  it("inverts a column whose banks show spending as positive", () => {
    const records = [
      ["Date", "Description", "Amount"],
      ["01/09/2026", "Shop", "10.00"],
    ];
    const mapping = guessMapping(records);
    if (mapping.amount.mode === "single") mapping.amount.invert = true;
    expect(applyMapping(records, mapping, "GBP").rows[0].amountMinor).toBe(-1000);
  });
});
