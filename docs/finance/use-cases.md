# Finance Use Cases

Uses the same format as the habit [use cases](../domain/use-cases.md).
**Impact score** (1–5): `5` core loop · `4` used daily or weekly ·
`3` meaningfully improves UX · `2` edge case / power user · `1` speculative.
**Status**: ⬜ not built yet (nothing is, so far). Rows are grouped by
category and sorted by impact within each group, and **Notes** link to
the doc that designs each one.

## At a glance

| Area | Built | Open | Highest-impact items |
| ---- | :---: | :--: | -------------------- |
| Account setup | 0 | 12 | Add a bank account, Add a credit card, See each account's balance, Choose a default account (5) |
| Quick log | 0 | 11 | Log an expense as amount + one tap on a category, Open quick log from anywhere, Undo (5) |
| Transactions | 0 | 6 | Full transaction form, Edit or delete a transaction, Transfer between accounts (4) |
| Categories | 0 | 4 | Default category set (4) |
| Budgets | 0 | 4 | Monthly budget per category, Budget vs actual (4) |
| Recurring & bills | 0 | 3 | Recurring transactions (4) |
| Savings goals | 0 | 3 | Create a goal, Track progress (3) |
| Reports & insights | 0 | 5 | Spend by category this month, Cash flow (4) |
| Data in / out | 0 | 2 | CSV import (4) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Account setup** | ⬜ | **Add a bank account** with today's balance (no history needed) | 5 | `openingBalanceMinor` + `openingBalanceDate`, see [account-setup.md](account-setup.md) |
|  | ⬜ | **Add a credit card** with credit limit, amount owed, statement day and due day | 5 | Type-specific `Account` columns, see [data-model.md](data-model.md) |
|  | ⬜ | **See each account's balance**, and for cards the available credit and utilisation bar | 5 | Derived values table in [account-setup.md](account-setup.md) |
|  | ⬜ | **Choose a default account** for quick log | 5 | `Account.isDefault`, exactly one, enforced by a partial unique index |
|  | ⬜ | **Update balance / reconcile** from the real balance, creating one adjustment | 4 | `reconcileAccount`, so missed logs don't break balances, see [account-setup.md](account-setup.md) |
|  | ⬜ | **Add a loan** (owed, APR, monthly payment) and see its estimated payoff date | 4 | Amortisation formula in [account-setup.md](account-setup.md) |
|  | ⬜ | **Card payment due soon** ("Amex due in 5 days") | 4 | `Account.nextDueDate`, amber within 7 days |
|  | ⬜ | **Net worth**: assets minus everything owed | 4 | Sum of the balance loader across accounts; watch the 32-bit limit, see [money-handling.md](money-handling.md) |
|  | ⬜ | **Pay off a card or loan** from a bank account without it counting as spending | 4 | A transfer, see [account-setup.md](account-setup.md) |
|  | ⬜ | **Track personal debts (IOUs)**: "I owe Sam £40", "Alex owes me £25", then settle up | 3 | `IOU` account type, see [account-setup.md](account-setup.md) |
|  | ⬜ | **Reorder accounts**, which also sets the quick-log account switcher order | 2 | `Account.sortOrder`, `reorderAccounts` |
|  | ⬜ | **Archive a closed account** and keep its history | 2 | `Account.archivedAt`, same soft-delete as habits |
| **Quick log** | ⬜ | **Log an expense as amount + one tap on a category** (under 5 s) | 5 | Tapping a category saves; everything else defaults, see [quick-log.md](quick-log.md) |
|  | ⬜ | **Open quick log from anywhere** (➕ button, `n` key, deep link, PWA shortcut) | 5 | See "Getting to the log screen" in [quick-log.md](quick-log.md) |
|  | ⬜ | **Undo** a log from the toast, with no confirmation dialogs | 5 | Reuses `deleteTransaction` |
|  | ⬜ | **Presets**: one tap logs "☕ Flat white £3.40" | 4 | `QuickPreset` model, see [quick-log-implementation.md](quick-log-implementation.md) |
|  | ⬜ | **Smart category chips** ranked by recency and time of day | 4 | Scoring in [quick-log-implementation.md](quick-log-implementation.md) |
|  | ⬜ | **Log now, categorise later**: uncategorised entries land in a "To review" inbox | 4 | `categoryId: null` + `uncategorisedOnly` filter |
|  | ⬜ | **Remember the account per category** (Fuel → Amex) | 3 | `lastAccountByCategory` in `quickLogContext` |
|  | ⬜ | **One-line entry**: "lunch 12.50 @amex" | 3 | Client-side `parseQuickLog`, see [quick-log-implementation.md](quick-log-implementation.md) |
|  | ⬜ | **Evening catch-up mode**: several entries in a row with the keypad kept open | 3 | See [quick-log.md](quick-log.md) |
|  | ⬜ | **"Save as preset?"** suggested after 3 repeats in 30 days | 2 | `QuickLogPayload.suggestPreset` |
|  | ⬜ | **No duplicate logs** from double taps or retries | 2 | `Transaction.clientId` upsert |
| **Transactions** | ⬜ | **Full transaction form** (payee, note, tags, any date) for when quick log isn't enough | 4 | `createTransaction`, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Edit or delete a transaction** | 4 | Deleting one leg of a transfer deletes both |
|  | ⬜ | **Transfer between accounts** without it counting as spending | 4 | Two rows sharing `transferId`, see [data-model.md](data-model.md) |
|  | ⬜ | **Search and filter** by date range, account, category, payee or text | 3 | `TransactionFilter` + cursor pagination, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Split a transaction** across categories (e.g. one supermarket receipt covering groceries and household) | 2 | Deferred: `TransactionSplit` table, see [data-model.md](data-model.md) |
|  | ⬜ | **Tag transactions** ("holiday-2026", "work-expense") alongside the category | 2 | `Transaction.tags` string array |
| **Categories** | ⬜ | **Default category set** seeded on first run (Groceries, Rent, Transport, Eating out…) | 4 | `CategoriesService.seedDefaults()` on module init, see [backend-module.md](backend-module.md) |
|  | ⬜ | **Category aliases** for the one-line parser ("latte", "starbucks" → Coffee) | 2 | `Category.metadata.aliases` |
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
