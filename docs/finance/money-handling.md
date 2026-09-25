# Money Handling

Get this right before writing any finance code. It's painful to change
after data exists.

## Store integer minor units, never floats

```js
0.1 + 0.2 // 0.30000000000000004
```

Store every amount as an **integer number of minor units** (pence/cents):
£12.34 is stored as `1234`. Sums, comparisons and budgets then stay exact.

| Option                              | Verdict                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `Float` (as `Habit.targetValue` uses) | ❌ Rounding errors accumulate in sums                                           |
| `Decimal @db.Decimal(14,2)`         | ✅ Exact, but Prisma returns `Prisma.Decimal` objects that every layer must handle |
| **`Int` minor units**               | ✅ Exact, plain JS numbers, maps directly to GraphQL `Int`                      |

The project uses **`Int` minor units**, and every field is named
`amountMinor` so the unit is explicit wherever it's read.

### Limit to know about

Postgres `integer` and GraphQL `Int` are both **signed 32-bit**. The maximum
is 2,147,483,647 minor units, about **£21.4 million** per value. That's fine
for personal transactions and budgets. If a net-worth total might exceed it:

- expose aggregate totals as a `String`, or define a custom `BigInt`-style
  scalar
- or use Prisma `BigInt` for aggregate columns only

Individual transactions never get close.

## Sign convention

- `amountMinor < 0`: money leaving the account (expense, transfer out)
- `amountMinor > 0`: money entering (income, transfer in, refund)

This makes a balance a plain `SUM(amountMinor)` and refunds work without
special cases. The UI shows absolute values and colours them.

## Currencies

Built: several currencies, one **main** currency for totals, and
**automatic daily exchange rates**. Configured at `/finance/currencies`.

- **Each account has one currency**, chosen from the currencies in use when
  the account is added (default: the main one). It can't change afterwards:
  the balance and history are in it. Transactions are in their account's
  currency; there are no per-transaction currencies.
- **Amounts stay in minor units of their own currency.** Conversion goes
  through major units, because currencies differ in decimals (GBP 2, VND 0):
  `lib/money.ts` / `currency-math.util.ts` use
  `Intl.NumberFormat(…).resolvedOptions().maximumFractionDigits`.
- **Totals are in the main currency**: net worth, account group subtotals,
  spending, budgets, a day's spending. Anything without a rate is left out
  and listed ("Not included: JPY"), never added up unconverted.
- **Rates** (`exchange_rates`: units per 1 USD, one row per currency per
  day) come from open.er-api.com (keyless, ~160 currencies incl. VND;
  attribution required and shown), falling back to
  fawazahmed0/currency-api on jsDelivr. `ExchangeRatesService` fetches on
  start and every 6 h when the newest day is stale; "Refresh rates" fetches
  now. Offline, the latest stored rates are used.
- **Past months convert at their own rate**: a month's figures use the rate
  of its last day (today's while it's still going), or the earliest stored
  rate for months before the first fetch.
- **Overrides**: a currency can have the user's own rate (main units per 1
  unit), which wins over fetched rates. Changing the main currency clears
  overrides, since they were relative to the old main.
- **Budgets remember their currency** (`Budget.currency`, the main currency
  when set), so changing the main currency converts limits instead of
  reinterpreting them (£250 doesn't become ₫250).
- Only real ISO 4217 codes can be added (`Intl.supportedValuesOf("currency")`).

## Formatting (frontend only)

```ts
// web/src/lib/money.ts (sketch)
export function formatMoney(amountMinor: number, currency = "GBP", locale?: string) {
  const fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(amountMinor / 10 ** digits);
}
```

Parsing user input goes the other way. Strip currency symbols and
separators, then use `Math.round(parseFloat(input) * 10 ** digits)`. Do
this once, in the form, and send only integers to the API.

## Dates

- A transaction happens on a **calendar day**, not an instant. Use
  `DateTime @db.Date`, the same as `HabitEntry.date` (see the Date gotchas in
  [prisma-and-data-access.md](../backend/prisma-and-data-access.md)).
- Resolve `Date` fields to `"YYYY-MM-DD"` strings explicitly in resolvers.
  `habits.resolvers.ts` has the same String-scalar trap for `Date`.
- "This month" is computed from the user's local date, then passed to the
  API as a `month: "2026-09"` argument. The server doesn't guess the time
  zone.
