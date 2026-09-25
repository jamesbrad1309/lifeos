# Finance Use Cases

Uses the same format as the habit [use cases](../domain/use-cases.md).
**Impact score** (1–5): `5` core loop · `4` used daily or weekly ·
`3` meaningfully improves UX · `2` edge case / power user · `1` speculative.
**Status**: ✅ built · 🟡 partly built (the note says what's missing) ·
⬜ not built yet, as of 2026-09-26 (phases 1–4, see [index.md](index.md#whats-built)).
Re-verify against the code before trusting a ⬜. Rows are grouped by
category and sorted by impact within each group, and **Notes** link to
the doc that designs each one.

## At a glance

| Area | ✅ | 🟡 | ⬜ | Top open items (impact) |
| ---- | :-: | :-: | :-: | ----------------------- |
| Account setup | 12 | 0 | 0 | — |
| Quick log | 10 | 1 | 0 | Open quick log from anywhere (partly) (5) |
| Transactions | 3 | 1 | 2 | Full transaction form (partly) (4), Split a transaction (2) |
| Categories | 2 | 1 | 1 | Custom categories (3), Auto-categorise by payee rule (partly) (3) |
| Budgets | 3 | 0 | 1 | Alert when a category passes 80% / 100% (2) |
| Recurring & bills | 0 | 0 | 3 | Recurring transactions (4), Upcoming bills (3) |
| Savings goals | 0 | 0 | 3 | Create a goal (3), Track progress (3) |
| Reports & insights | 2 | 0 | 3 | Cash flow (4), Top payees (2) |
| Languages & currency | 2 | 0 | 0 | — |
| Data in / out | 1 | 0 | 1 | CSV export (2) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Account setup** | ✅ | **Add a bank account** with today's balance (no history needed) | 5 | `openingBalanceMinor` + `openingBalanceDate`, see [account-setup.md](account-setup.md) |
|  | ✅ | **Add a credit card** with credit limit, amount owed, statement day and due day | 5 | Type-specific `Account` columns, see [data-model.md](data-model.md) |
|  | ✅ | **See each account's balance**, and for cards the available credit and utilisation bar | 5 | Derived values table in [account-setup.md](account-setup.md) |
|  | ✅ | **Choose a default account** for quick log | 5 | `Account.isDefault`, exactly one, enforced by a partial unique index. Only spendable accounts (current, savings, card, cash) can be the default. |
|  | ✅ | **Update balance / reconcile** from the real balance, creating one adjustment | 4 | `reconcileAccount`, so missed logs don't break balances, see [account-setup.md](account-setup.md). Previews the adjustment before saving. |
|  | ✅ | **Add a loan** (owed, APR, monthly payment) and see its estimated payoff date | 4 | Amortisation formula in [account-setup.md](account-setup.md). Also flags a payment that doesn't cover the interest. |
|  | ✅ | **Card payment due soon** ("Amex due in 5 days") | 4 | `Account.nextDueDate`, amber within 7 days. Also listed under "Coming up" on Money setup. |
|  | ✅ | **Net worth**: assets minus everything owed | 4 | Sum of the balance loader across accounts; watch the 32-bit limit, see [money-handling.md](money-handling.md). Returns assets and owed as well as the total. |
|  | ✅ | **Pay off a card or loan** from a bank account without it counting as spending | 4 | A transfer, see [account-setup.md](account-setup.md). "Pay off" on the card or loan opens the transfer dialog with the amount owed filled in. |
|  | ✅ | **Track personal debts (IOUs)**: "I owe Sam £40", "Alex owes me £25", then settle up | 3 | `IOU` account type, see [account-setup.md](account-setup.md). "Settle up" is a transfer between the IOU and a bank account or wallet. |
|  | ✅ | **Reorder accounts**, which also sets the quick-log account switcher order | 2 | `Account.sortOrder`, `reorderAccounts`. Up/down buttons within a group; no drag and drop. |
|  | ✅ | **Archive a closed account** and keep its history | 2 | `Account.archivedAt`, same soft-delete as habits. Archived accounts can be restored. |
| **Quick log** | ✅ | **Log an expense as amount + one tap on a category** (under 5 s) | 5 | Tapping a category saves; everything else defaults, see [quick-log.md](quick-log.md) |
|  | 🟡 | **Open quick log from anywhere** (➕ button, `n` key, deep link, PWA shortcut) | 5 | Built: ➕ button, `n` key, `/log?amount=&category=` deep link. Missing: PWA shortcut. See "Getting to the log screen" in [quick-log.md](quick-log.md) |
|  | ✅ | **Undo** a log from the toast, with no confirmation dialogs | 5 | Reuses `deleteTransaction` |
|  | ✅ | **Presets**: one tap logs "☕ Flat white £3.40" | 4 | `QuickPreset` model, see [quick-log-implementation.md](quick-log-implementation.md) |
|  | ✅ | **Smart category chips** ranked by recency and time of day | 4 | Scoring in [quick-log-implementation.md](quick-log-implementation.md). Uses the user's time-zone offset to read the logged hour. |
|  | ✅ | **Log now, categorise later**: uncategorised entries land in a "To review" inbox | 4 | `categoryId: null` + `uncategorisedOnly` filter. Sidebar badge; focus moves to the next item after filing one. |
|  | ✅ | **Remember the account per category** (Fuel → Amex) | 3 | `lastAccountByCategory` in `quickLogContext` |
|  | ✅ | **One-line entry**: "lunch 12.50 @amex" | 3 | Client-side `parseQuickLog`, see [quick-log-implementation.md](quick-log-implementation.md). English and Vietnamese, accents optional; unit-tested. |
|  | ✅ | **Evening catch-up mode**: several entries in a row with the keypad kept open | 3 | See [quick-log.md](quick-log.md). "Log several (stay open)" shows today's entries under the sheet. |
|  | ✅ | **"Save as preset?"** suggested after 3 repeats in 30 days | 2 | `QuickLogPayload.suggestPreset` |
|  | ✅ | **No duplicate logs** from double taps or retries | 2 | `Transaction.clientId` upsert. Verified: 10 identical concurrent requests → 1 transaction. |
| **Transactions** | 🟡 | **Full transaction form** (payee, note, tags, any date) for when quick log isn't enough | 4 | Built: amount, date, account, category, payee, note. Missing: tags in the form (the API accepts them). `createTransaction`, see [graphql-schema.md](graphql-schema.md) |
|  | ✅ | **Edit or delete a transaction** | 4 | Deleting one leg of a transfer deletes both. Delete is undoable from a toast. |
|  | ✅ | **Transfer between accounts** without it counting as spending | 4 | Two rows sharing `transferId`, see [data-model.md](data-model.md). Cross-currency transfers take the amount received, pre-filled from today's rate. Idempotent via `clientId`. |
|  | ✅ | **Search and filter** by date range, account, category, payee or text | 3 | `TransactionFilter` + cursor pagination, see [graphql-schema.md](graphql-schema.md). Month, account, category and payee/note search, all in the URL. |
|  | ⬜ | **Split a transaction** across categories (e.g. one supermarket receipt covering groceries and household) | 2 | Deferred: `TransactionSplit` table, see [data-model.md](data-model.md) |
|  | ⬜ | **Tag transactions** ("holiday-2026", "work-expense") alongside the category | 2 | Stored and accepted by the API; no UI yet. `Transaction.tags` string array |
| **Categories** | ✅ | **Default category set** seeded on first run (Groceries, Rent, Transport, Eating out…) | 4 | `CategoriesService.seedDefaults()` on module init, see [backend-module.md](backend-module.md). 15 categories with English + Vietnamese parser aliases; names translated via `metadata.key`. |
|  | ✅ | **Category aliases** for the one-line parser ("latte", "starbucks" → Coffee) | 2 | `Category.metadata.aliases` |
|  | ⬜ | **Custom categories** with icon and colour, grouped under parents ("Food › Eating out") | 3 | `POST /categories` exists; no UI and no parent/child yet. Self-relation `Category.parent` |
|  | 🟡 | **Auto-categorise by payee rule** ("TESCO*" → Groceries) | 3 | Built: quick log and CSV import reuse a payee's last category, and import falls back to category names and aliases in the payee. Missing: rules you write yourself. See [recurring-and-import.md](recurring-and-import.md) |
| **Budgets** | ✅ | **Monthly budget per category** | 4 | `Budget(categoryId, month)`, see [budgets-and-reports.md](budgets-and-reports.md). Carries forward from the month it's set; see [index.md](index.md#whats-built). |
|  | ✅ | **Budget vs actual** progress bars, coloured by pace ("68% spent, 50% of the month gone") | 4 | One `groupBy` per month + pace colouring, see [budgets-and-reports.md](budgets-and-reports.md). Status colour + icon + label, and an "on pace today" tick. |
|  | ✅ | **Rollover**: carry unspent budget into next month | 2 | Computed over a bounded window, not stored. 12-month window; an overspend never carries. |
|  | ⬜ | **Alert when a category passes 80% / 100%** | 2 | Pace status shows "over", but there are no threshold alerts. In-app only; notifications are out of scope |
| **Recurring & bills** | ⬜ | **Recurring transactions** (rent, salary, subscriptions) generated on schedule | 4 | Lazy, idempotent catch-up, see [recurring-and-import.md](recurring-and-import.md) |
|  | ⬜ | **Upcoming bills** for the next 30 days | 3 | Card and IOU due dates are in "Coming up"; recurring bills aren't. Same schedule walker, read-only for future dates |
|  | ⬜ | **Subscription audit**: list every recurring expense with its yearly cost | 3 | List active `RecurringRule`s × occurrences per year |
| **Savings goals** | ⬜ | **Create a goal** (target amount, optional deadline, linked account) | 3 | `SavingsGoal` model, see [data-model.md](data-model.md) |
|  | ⬜ | **Track progress** with "on track / behind" based on the deadline | 3 | `SavingsGoal.onTrack`, see [graphql-schema.md](graphql-schema.md) |
|  | ⬜ | **Required monthly saving** to reach the goal on time | 2 | `requiredPerMonthMinor` |
| **Reports & insights** | ✅ | **Spend by category this month** (donut or bar chart) | 4 | `spendByCategory(month)`, see [budgets-and-reports.md](budgets-and-reports.md). Read from the `monthly_totals` aggregate, not computed per request. |
|  | ⬜ | **Cash flow**: income vs expenses per month for the last 12 months | 4 | Will read `monthly_totals` too. Raw SQL `date_trunc('month')`, see [budgets-and-reports.md](budgets-and-reports.md) |
|  | ✅ | **Month-over-month change per category** ("Eating out +42%") | 3 | Two `spendByCategory` calls, diffed on the client. Built into Spending (`previousSpentMinor`). |
|  | ⬜ | **Top payees** | 2 | `groupBy(["payee"])` over a date range |
|  | ⬜ | **Net worth over time** | 2 | Running balance per month from `cashFlow` + opening balances |
| **Languages & currency** | ✅ | **Use the app in English or Vietnamese**, including amounts, dates and category names | 4 | See [i18n.md](../frontend/i18n.md). Amounts accept "12,50" and "12.50" |
|  | ✅ | **Choose the currencies I use**, and a main currency for totals | 4 | `/finance/currencies`: daily rates fetched automatically, overridable per currency; see [money-handling.md](money-handling.md#currencies) |
| **Data in / out** | ✅ | **CSV import** from a bank export with column mapping and duplicate detection | 4 | Parsed on the server; the upload is deleted once imported or cancelled. Column mapping + `importHash` dedupe, see [recurring-and-import.md](recurring-and-import.md) |
|  | ⬜ | **CSV export** of transactions | 2 | Stream `transactions(filter)` to CSV on the client |

## Out of scope for v1

- Live bank sync (Open Banking / Plaid)
- Investment holdings, prices and portfolio performance
- Tax reporting, invoices, shared or household budgets
