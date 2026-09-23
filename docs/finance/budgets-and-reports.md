# Budgets & Reports

Everything here is **computed at query time** from `Transaction` rows, the
same way habit streaks are. The only stored budget data is the limit itself.

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
| `spendByCategory`   | The same `groupBy(["categoryId"])` as above, for a single month                |
| `cashFlow(months)`  | Raw SQL `date_trunc('month', date)` grouping. Prisma `groupBy` can't group by an expression |
| Month-over-month    | Two `spendByCategory` calls; diff on the client                                |
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
