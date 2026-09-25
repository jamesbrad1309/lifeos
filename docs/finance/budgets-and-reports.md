# Budgets & Reports

Reports read the **`monthly_totals` aggregate table**, not `Transaction`
rows (this replaced the original "computed at query time" plan). See
[Monthly totals](#monthly-totals-the-aggregate-table) below. The only stored
budget data is the limit itself; its "spent" side comes from the same
table. Budgets are built: see "Phase 3" in [index.md](index.md#whats-built)
for how they carry forward, which differs from the per-month sketch below.

## Monthly totals: the aggregate table

`monthly_totals` holds one row per **(month, account, category)**:
`outflowMinor`, `inflowMinor` (both positive) and `transactionCount`. A
month's report is a few dozen rows however many transactions it has, and
budgets, cash flow and month-over-month all read the same table.

**Kept in step on write, atomically.** `MonthlyTotalsService.apply` is
called with the Prisma transaction client from every transaction write
(`TransactionsService.create/update/remove`, and reconcile), so a row and
its totals commit together or not at all:

| Write | Totals change |
| ----- | ------------- |
| Create | +1 in the new row's bucket |
| Update | −1 in the old bucket, +1 in the new one (the same bucket nets out; a payee-only edit changes nothing) |
| Delete | −1 per deleted row (both legs of a transfer) |

- **Counted rows**: not transfers (`transferId` set) and not balance
  adjustments (`source = "adjustment"`). `isCounted` is the one place this
  rule lives in code; the migration's backfill and `rebuild` repeat it in SQL.
- **Additions** are `INSERT … ON CONFLICT DO UPDATE SET x = x + excluded.x`,
  so concurrent writes to the same bucket add up. The unique key is
  `(month, accountId, categoryId) NULLS NOT DISTINCT` (Postgres 15+),
  which makes "uncategorised" one bucket too.
- **Removals and in-place edits** are a plain `UPDATE … SET x = x + delta`
  and must hit exactly one row. Postgres evaluates CHECK constraints on the
  `VALUES` row *before* `ON CONFLICT` becomes an update, so a negative
  delta can't go through the upsert even when the row exists. A bucket that
  reaches zero transactions is deleted.
- **Edits and deletes lock the row first** (`SELECT … FOR UPDATE` inside the
  transaction), so two concurrent edits or deletes of the same transaction
  can't both subtract its old values.
- **CHECK constraints** (every total ≥ 0, `month` is the 1st) make drift
  fail a write loudly instead of producing wrong reports.
- **Recovery and verification:** `POST /reports/monthly-totals/rebuild`
  (API only, not exposed through GraphQL) recounts from `transactions` under
  a table lock, replaces the table, and returns `{ rows, drifted }`.
  `drifted: 0` means the totals were already right, so the same call is the
  consistency check.

Verified with a randomised concurrent stress test (120 parallel creates,
~130 edits and deletes in concurrent waves including the same row twice,
10 identical quick logs at once, reconciles): 0 drifted rows, and report
totals equal to a direct SQL sum over `transactions`.

**Not in the table:** anything below a month (daily spend) and
payee-level breakdowns still query `transactions` directly, with the
`(accountId, date)` and `(categoryId, date)` indexes.

## Month range helper

```ts
// finance/money.util.ts (sketch)
export function monthRange(month: string) {          // "2026-09"
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));              // exclusive
  return { from, to };
}
```

The helper uses UTC midnight because `@db.Date` columns round-trip as UTC
midnight in Prisma. See
[prisma-and-data-access.md](../backend/prisma-and-data-access.md).

## Budget vs actual

```ts
// budgets.service.ts (sketch)
async budgetFor(month: string) {
  const { from, to } = monthRange(month);
  const [budgets, spend] = await Promise.all([
    this.prisma.budget.findMany({ where: { month: from }, include: { category: true } }),
    this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { date: { gte: from, lt: to }, transferId: null, amountMinor: { lt: 0 } },
      _sum: { amountMinor: true },
    }),
  ]);
  const spent = new Map(spend.map((s) => [s.categoryId, -(s._sum.amountMinor ?? 0)]));
  return budgets.map((b) => ({
    category: b.category,
    month,
    limitMinor: b.amountMinor,
    spentMinor: spent.get(b.categoryId) ?? 0,
    // remainingMinor / monthProgress computed in the resolver
  }));
}
```

- **One `groupBy` for the whole month**, not one query per category.
- **Refunds reduce spend.** Filtering on `amountMinor < 0` ignores them,
  which is wrong. A more accurate version sums all non-transfer rows in the
  category and negates the result. Pick one and document it in the resolver.
- **Parent categories**: a budget on "Food" should include "Food › Eating
  out". Load the category tree once, map each child to its root, and sum
  in memory.

### Pace colouring

`monthProgress = dayOfMonth / daysInMonth`. Compare it with
`spent / limit`:

| Condition                        | Colour |
| -------------------------------- | ------ |
| spent/limit ≤ monthProgress      | green  |
| ≤ monthProgress + 0.15           | amber  |
| above that, or spent > limit     | red    |

The server returns the raw numbers and the frontend chooses colours.
That's the same split as habit points, where the server owns the formula
and the UI owns presentation.

### Rollover

When `rollover` is true, the effective limit is this month's limit plus
last month's `remainingMinor`, with a floor of 0 so overspending doesn't
cascade. Compute it recursively for a bounded window (for example 12
months). Don't store a running balance.

## Reports

| Query               | Implementation                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `spendByCategory`   | **Built.** `ReportsService.spendByCategory` reads `monthly_totals` for the month and the one before; refunds reduce a category's spend (`outflow − inflow`), income categories go to `incomeMinor` |
| `cashFlow(months)`  | Sum `inflowMinor` / `outflowMinor` per month from `monthly_totals` (no `date_trunc` over transactions needed) |
| Month-over-month    | Built into `spendByCategory` (`previousSpentMinor` per category)               |
| `netWorthMinor`     | Sum of the balance loader over all non-archived accounts. Liabilities are already negative |

```ts
// reports.service.ts: cashFlow via $queryRaw (sketch)
const rows = await this.prisma.$queryRaw<{ month: Date; income: bigint; expense: bigint }[]>`
  SELECT date_trunc('month', date) AS month,
         SUM(CASE WHEN "amountMinor" > 0 THEN "amountMinor" ELSE 0 END) AS income,
         SUM(CASE WHEN "amountMinor" < 0 THEN -"amountMinor" ELSE 0 END) AS expense
  FROM transactions
  WHERE "transferId" IS NULL AND date >= ${since}
  GROUP BY 1 ORDER BY 1`;
```

Postgres `SUM` over `integer` returns `bigint`, which Prisma gives back as
a JS `BigInt`. Convert it with `Number(...)` before returning it, because
GraphQL `Int` can't serialise `BigInt`.
