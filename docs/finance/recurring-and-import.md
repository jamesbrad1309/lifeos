# Recurring Transactions & CSV Import

These are the two ways to get data in without typing every row by hand.

## Recurring rules

A `RecurringRule` (see [data-model.md](data-model.md)) describes a repeating
transaction: rent on the 1st, salary on the 25th, Netflix monthly.

### Schedule shape

Habit schedules (`schedule.util.ts`) are day-based: `daily`, `weekly`,
`timesPerWeek`, `interval`. Bills are mostly **monthly or yearly**, so the
finance module uses its own discriminated union, validated with zod the
same way:

```ts
type RecurringSchedule =
  | { type: "weekly"; dayOfWeek: number }            // 0–6
  | { type: "monthly"; dayOfMonth: number }          // 1–31, clamped to month length
  | { type: "yearly"; month: number; day: number };
```

`dayOfMonth: 31` in February becomes the 28th/29th, so rent due "on the last
day" still happens. Write `isDueOn(schedule, date)` for this union
alongside the habits version, as a pure function with unit tests.

### Generation: lazy and idempotent

There's no cron job and no queue. Generate transactions when they're
needed:

1. On any finance query (or on `onModuleInit`), call
   `RecurringService.catchUp(today)`.
2. For each active rule, walk dates from
   `lastGeneratedOn + 1` (or `startDate`) to `today`, and create a
   transaction for each due date.
3. Set `lastGeneratedOn = today`, **in the same `$transaction`** as the
   creates.

Because of step 3, running catch-up twice creates nothing the second time.
Restarting the server or skipping days is also safe: the next run fills the
gap. `upcomingBills(days)` uses the same walker for future dates but doesn't
write anything.

Changing a rule's amount only affects future generations. Past
transactions are real history.

## CSV import

### Flow

1. The user picks an account and a `.csv` file in the browser.
2. The browser reads it with `file.text()` and shows the first rows so the
   user can map columns (date, amount or debit/credit, payee, reference).
   Store that mapping per account in `Account.metadata` so the next import
   is one click.
3. `importTransactionsCsv(accountId, csv, mapping)` parses, validates and
   inserts the rows.

### Parsing

- Use a real CSV parser (e.g. `csv-parse`, or Papa Parse in the browser).
  Payees contain commas and quotes.
- **Date formats vary by bank.** `03/04/2026` is 3 April in the UK and
  March 4 in the US. Include `dateFormat` in the mapping and never guess.
- **Amounts**: some banks use a single signed column and some use separate
  debit and credit columns. Normalise to signed `amountMinor` with
  `Math.round(Number(str.replace(/[^0-9.-]/g, "")) * 100)`, and use the
  currency's exponent (see [money-handling.md](money-handling.md)).

### Dedupe

```ts
importHash = sha256(`${accountId}|${date}|${amountMinor}|${normalise(payee)}|${occurrence}`)
```

- `occurrence` is the row's index among identical
  `(date, amount, payee)` rows in *this file*. Two genuine £3.50 coffees on
  the same day then both import, and re-importing the file still skips
  both.
- Insert with `createMany({ data, skipDuplicates: true })`. The
  `@@unique([accountId, importHash])` index does the work. Report
  `skippedDuplicates = rows − inserted.count`.

### Auto-categorisation

After parsing, apply payee rules (`"TESCO*" → Groceries`) before insert.
Rules can live in a small `CategoryRule(pattern, categoryId)` table, or as
JSON on `Category.metadata` to begin with. A useful next step: when the
user recategorises an imported row, offer to create a rule from its payee.
