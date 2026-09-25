import { describe, expect, it } from "vitest";
import { type ParseContext, type ParsedLog, parseQuickLog } from "#lib/quick-log-parse";

const category = (id: string, name: string, aliases: string[] = [], kind = "expense") => ({
  id,
  name,
  aliases,
  kind,
});

const ctx: ParseContext = {
  categories: [
    category("coffee", "Coffee", ["latte", "flat white", "cà phê"]),
    category("eat", "Eating out", ["lunch", "dinner", "ăn trưa"]),
    category("groc", "Groceries", ["tesco", "đi chợ"]),
    category("tr", "Transport", ["bus", "tube"]),
    category("sal", "Salary", ["payday"], "income"),
  ],
  presets: [{ id: "p1", label: "Tube", amountMinor: 280, payee: null, category: { id: "tr" } }],
  accounts: [
    { id: "amex", name: "Amex Gold" },
    { id: "monzo", name: "Monzo Current" },
  ],
  payees: [
    { payee: "Pret", categoryId: "coffee" },
    { payee: "Sainsbury's", categoryId: "groc" },
  ],
};

const cases: [string, Partial<ParsedLog>][] = [
  ["3.4 coffee", { amountMinor: 340, categoryId: "coffee", note: null }],
  ["lunch 12.50 @amex", { amountMinor: 1250, categoryId: "eat", accountId: "amex", note: "lunch" }],
  ["tesco 23.10", { amountMinor: 2310, categoryId: "groc", note: "tesco" }],
  ["pret 4.20", { amountMinor: 420, categoryId: "coffee", payee: "Pret", matchedBy: "payee" }],
  ["sainsburys 12", { amountMinor: 1200, categoryId: "groc", payee: "Sainsbury's" }],
  ["tube", { amountMinor: 280, categoryId: "tr", presetId: "p1", matchedBy: "preset" }],
  ["tube 3", { amountMinor: 300, presetId: "p1" }],
  ["3,40 latte", { amountMinor: 340, categoryId: "coffee", note: "latte" }],
  ["flat white 3.40", { categoryId: "coffee", note: "flat white" }],
  ["birthday card 2.99", { amountMinor: 299, categoryId: null, note: "birthday card" }],
  ["12 @mon", { amountMinor: 1200, accountId: "monzo" }],
  ["payday 2500", { amountMinor: 250000, categoryId: "sal" }],
  ["whitening 5", { categoryId: null, note: "whitening" }],
  ["Coffee with Sam 3.2", { categoryId: "coffee", note: "with Sam", amountMinor: 320 }],
  ["café 2", { amountMinor: 200, note: "café" }],
  ["", { amountMinor: null, categoryId: null, note: null }],
  // Vietnamese, with and without diacritics.
  ["cà phê 35", { amountMinor: 3500, categoryId: "coffee" }],
  ["ca phe sua 29", { amountMinor: 2900, categoryId: "coffee", note: "ca phe sua" }],
  ["ăn trưa với Lan 120", { categoryId: "eat", note: "ăn trưa với Lan" }],
  ["di cho 250", { amountMinor: 25000, categoryId: "groc" }],
];

describe("parseQuickLog", () => {
  it.each(cases)("%j", (input, expected) => {
    expect(parseQuickLog(input, ctx)).toMatchObject(expected);
  });
});
