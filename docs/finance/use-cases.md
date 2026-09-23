# Finance Use Cases

Uses the same format as the habit [use cases](../domain/use-cases.md).
**Impact score** (1–5): `5` core loop · `4` used daily or weekly ·
`3` meaningfully improves UX · `2` edge case / power user · `1` speculative.
**Status**: ⬜ not built yet (nothing is, so far). Rows are grouped by
category and sorted by impact within each group, and **Notes** link to
the doc that designs each one.

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Accounts** | ⬜ | **Create an account** (name, type: current / savings / credit card / cash / investment, opening balance) | 5 | `Account` model, see [data-model.md](data-model.md) |
|  | ⬜ | **See each account's current balance** | 5 | Derived from opening balance + transactions, see [data-model.md](data-model.md) |
|  | ⬜ | **Net worth**: assets minus liabilities across all accounts | 4 | Sum of the balance loader across accounts; watch the 32-bit limit, see [money-handling.md](money-handling.md) |
|  | ⬜ | **Archive a closed account** and keep its history | 2 | `Account.archivedAt`, same soft-delete as habits |
| **Transactions** | ⬜ | **Log an expense or income** (amount, date, payee, category, note) | 5 | `createTransaction`, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Quick-add from the dashboard** in two taps: amount + category | 4 | `QuickAddExpense`, see [frontend.md](frontend.md) |
|  | ⬜ | **Edit or delete a transaction** | 4 | Deleting one leg of a transfer deletes both |
|  | ⬜ | **Transfer between accounts** without it counting as spending | 4 | Two rows sharing `transferId`, see [data-model.md](data-model.md) |
|  | ⬜ | **Search and filter** by date range, account, category, payee or text | 3 | `TransactionFilter` + cursor pagination, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Split a transaction** across categories (e.g. one supermarket receipt covering groceries and household) | 2 | Deferred: `TransactionSplit` table, see [data-model.md](data-model.md) |
|  | ⬜ | **Tag transactions** ("holiday-2026", "work-expense") alongside the category | 2 | `Transaction.tags` string array |
| **Categories** | ⬜ | **Default category set** seeded on first run (Groceries, Rent, Transport, Eating out…) | 4 | `CategoriesService.seedDefaults()` on module init, see [backend-module.md](backend-module.md) |
|  | ⬜ | **Custom categories** with icon and colour, grouped under parents ("Food › Eating out") | 3 | Self-relation `Category.parent` |
|  | ⬜ | **Auto-categorise by payee rule** ("TESCO*" → Groceries) | 3 | Applied during import, see [recurring-and-import.md](recurring-and-import.md) |
| **Budgets** | ⬜ | **Monthly budget per category** | 4 | `Budget(categoryId, month)`, see [budgets-and-reports.md](budgets-and-reports.md) |
|  | ⬜ | **Budget vs actual** progress bars, coloured by pace ("68% spent, 50% of the month gone") | 4 | One `groupBy` per month + pace colouring, see [budgets-and-reports.md](budgets-and-reports.md) |
|  | ⬜ | **Rollover**: carry unspent budget into next month | 2 | Computed over a bounded window, not stored |
|  | ⬜ | **Alert when a category passes 80% / 100%** | 2 | In-app only; notifications are out of scope |
| **Recurring & bills** | ⬜ | **Recurring transactions** (rent, salary, subscriptions) generated on schedule | 4 | Lazy, idempotent catch-up, see [recurring-and-import.md](recurring-and-import.md) |
|  | ⬜ | **Upcoming bills** for the next 30 days | 3 | Same schedule walker, read-only for future dates |
|  | ⬜ | **Subscription audit**: list every recurring expense with its yearly cost | 3 | List active `RecurringRule`s × occurrences per year |
| **Savings goals** | ⬜ | **Create a goal** (target amount, optional deadline, linked account) | 3 | `SavingsGoal` model, see [data-model.md](data-model.md) |
|  | ⬜ | **Track progress** with "on track / behind" based on the deadline | 3 | `SavingsGoal.onTrack`, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Required monthly saving** to reach the goal on time | 2 | `requiredPerMonthMinor` |
| **Reports & insights** | ⬜ | **Spend by category this month** (donut or bar chart) | 4 | `spendByCategory(month)`, see [budgets-and-reports.md](budgets-and-reports.md) |
|  | ⬜ | **Cash flow**: income vs expenses per month for the last 12 months | 4 | Raw SQL `date_trunc('month')`, see [budgets-and-reports.md](budgets-and-reports.md) |
|  | ⬜ | **Month-over-month change per category** ("Eating out +42%") | 3 | Two `spendByCategory` calls, diffed on the client |
|  | ⬜ | **Top payees** | 2 | `groupBy(["payee"])` over a date range |
|  | ⬜ | **Net worth over time** | 2 | Running balance per month from `cashFlow` + opening balances |
| **Data in / out** | ⬜ | **CSV import** from a bank export with column mapping and duplicate detection | 4 | Column mapping + `importHash` dedupe, see [recurring-and-import.md](recurring-and-import.md) |
|  | ⬜ | **CSV export** of transactions | 2 | Stream `transactions(filter)` to CSV on the client |

## Out of scope for v1

- Live bank sync (Open Banking / Plaid)
- Multiple currencies with FX conversion
- Investment holdings, prices and portfolio performance
- Tax reporting, invoices, shared or household budgets
