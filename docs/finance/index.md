# Finance Module

A plan for adding personal finance tracking to LifeOS alongside habits.
It rests on two ideas:

1. **Set up once, thoroughly.** A single "Money setup" screen covers bank
   accounts, credit cards with their limits, loans and personal debts.
2. **Log in seconds.** Logging a typical expense takes an amount plus one
   tap, because logging every expense by hand is where people give up on
   finance apps.

Categories, budgets, recurring bills, savings goals and reports build on
top of those two. **Phases 1–3 (Money setup, quick log and transactions,
spend by category, budgets) are built; the rest is design.**
See [What's built](#whats-built) below. These docs describe how to build it
on the existing stack without new infrastructure:

- another Nest module next to `habits/`
- another colocated feature folder under `graphql/`
- more models in the same `schema.prisma`
- another view in the web app

## Read in this order

1. [Use cases](use-cases.md): what the module should do, with impact scores
2. [Account setup](account-setup.md): bank accounts, cards and limits, loans, IOUs, reconciling
3. [Quick log](quick-log.md): the fast logging UX
4. [Quick log implementation](quick-log-implementation.md): API, category ranking, parser, idempotency
5. [Money handling](money-handling.md): integer minor units, currency, dates (read before touching any amounts)
6. [Data model](data-model.md): Prisma models and why balances are derived
7. [Backend module](backend-module.md): Nest module, services, DTOs, context wiring
8. [GraphQL schema](graphql-schema.md): SDL for the BFF's `graphql/finance/`
9. [Budgets & reports](budgets-and-reports.md): monthly budgets, spend by category, cash flow
10. [Recurring transactions & CSV import](recurring-and-import.md): getting data in without typing every row
11. [Frontend](frontend.md): screens, components, Apollo queries, formatting money
12. [Habits integration](habits-integration.md): no-spend days, savings streaks, shared XP

## Suggested build order

| Phase | Scope                                                        | Unlocks                           |
| ----- | ------------------------------------------------------------ | --------------------------------- |
| 1 ✅  | Money setup: all account types, derived balances, reconcile  | Cards, limits and debts in one place |
| 2 ✅  | Quick log: sheet, chips, presets, undo, "To review" inbox; transaction list | Everyday logging |
| 2b ✅ | Spend by category this month                                 | "Where did my money go?"          |
| 3 ✅  | `Budget` + budget-vs-actual view                             | Spending limits                   |
| 4 ✅  | Transfers (pay off, settle up) and CSV import with dedupe    | Real bank data in minutes         |
| 5     | `RecurringRule`, `SavingsGoal`                               | Bills and goals                   |
| 6     | Habits integration                                           | Features that span both modules   |

## What's built

**Phase 1: Money setup**, at `/finance/accounts` in the web app.

| Layer | Where | Notes |
| ----- | ----- | ----- |
| Data | `schema.prisma`: `Account`, `Category`, `Transaction` (migration `add_finance_accounts`) | Budget, RecurringRule, SavingsGoal and QuickPreset tables come with their phases. The migration adds two hand-written partial unique indexes: one default account, unique top-level category names |
| API | `apps/api/src/finance/` | `accounts.controller.ts` (REST below), `accounts.service.ts`, `categories.service.ts` (upserts the system "Adjustment" category on start), pure rules in `account-metrics.util.ts` and `calendar.util.ts` |
| BFF | `apps/bff/src/graphql/finance/` | Derived fields resolve through the `accountMetrics` DataLoader: one `/accounts/balances` call per request |
| Web | `components/finance/setup/`, `lib/money.ts`, `lib/account-types.ts`, `routes/finance/` | Grouped accounts, net worth, "Coming up" (card due dates, IOUs), type-picker form, Update balance with a preview of the adjustment, archive/restore |

REST endpoints: `GET /accounts[?archived=true]`, `GET /accounts/balances?ids=…&today=…`,
`GET /accounts/net-worth`, `POST /accounts`, `PUT /accounts/:id`,
`POST /accounts/reorder`, `POST /accounts/:id/{archive,unarchive,default,reconcile}`.

Decisions made while building it, which differ from the sketches in these docs:

- **Editing doesn't touch the balance or the type.** `UpdateAccountInput`
  has no balance: the balance changes only through "Update balance", which
  records the difference. The type can't change, because it decides what
  the balance's sign means.
- **Only spendable accounts can be the default** (current, savings, card,
  cash), because the default is where quick log spends from. The first one
  added becomes the default. Archiving the default passes it to the next
  spendable account.
- **`netWorth` returns `{ netWorthMinor, assetsMinor, liabilitiesMinor }`**
  instead of a single Int, for the "Assets · Owed" line.
- **`paymentCoversInterest: Boolean`** on `Account` tells "never pays off"
  apart from "no monthly payment set" (both have a null payoff month).
- **`reconcileAccount.actualBalanceMinor` is signed** (negative = owed); the
  web converts what was typed with `signedBalance` in `lib/account-types.ts`.
- **Card statement spend** excludes transfers and adjustments.
- Reordering is up/down buttons within a group, not drag and drop yet.

**Phase 2: Quick log and transactions.**

| Layer | Where | Notes |
| ----- | ----- | ----- |
| Data | Migration `add_quick_log`: `QuickPreset`, plus `Category.sortOrder`/`createdAt` | 15 default categories (with parser aliases) are seeded into an empty table on start |
| API | `transactions.service.ts`, `quick-log.service.ts`, `categories.service.ts` and their controllers | Cursor pagination on `(date, createdAt, id)`; `clientId` idempotency (a unique-violation race returns the first save); category ranking in `rankCategories` |
| BFF | `graphql/finance/transactions.resolvers.ts`, `quick-log.resolvers.ts` | `accountById` / `categoryById` DataLoaders resolve every row's account and category in one call each |
| Web | `components/finance/quick-log/`, `components/finance/transactions/`, `lib/quick-log-parse.ts`, `lib/toast.ts`, `hooks/useQuickLog.ts` | Floating ➕ and `n` on every page, `/log?amount=&category=` deep link, `/finance/transactions` with the "To review" inbox and a sidebar badge |

REST endpoints: `GET/POST /transactions`, `GET /transactions/to-review-count`,
`GET/PATCH/DELETE /transactions/:id`, `GET/POST /categories` (`?ids=` for
batches), `POST /categories/:id/dismiss-preset-suggestion`,
`GET /quick-log/context`, `POST /quick-log`, `GET/POST /quick-log/presets`,
`DELETE /quick-log/presets/:id`, and `GET /accounts?ids=`.

Where phase 2 differs from [quick-log-implementation.md](quick-log-implementation.md):

- **`quickLogContext` also takes `utcOffsetMinutes`**, because the logged
  hour comes from `createdAt` (UTC) and has to be shifted to the user's
  clock before comparing with `hour`.
- **`recentPayees` is `[PayeeHint!]!`** (`payee` + `category`), because the
  parser needs "tesco → Groceries" and not just the name. Payees are
  deduplicated case-insensitively.
- **`QuickLogPayload.presetKey`** identifies the combination;
  `dismissPresetSuggestion(categoryId, key)` stores the "no" in
  `Category.metadata.dismissedPresetSuggestions`. The web app dismisses
  when the "Save as preset?" toast times out, so it's offered once.
- **Parser matching order** is presets → known payees → category names and
  aliases. A matched alias ("lunch") stays in the note; a matched category
  name ("coffee") doesn't.
- **Not optimistic yet.** The save is ~20 ms locally, so the toast follows
  the server's reply. Offline queueing, the PWA manifest shortcut and
  "Split with…" are still to do.
- **`deleteTransaction` returns `[ID!]!`**, every id deleted (both legs
  for a transfer). Transfers themselves ("Pay off card") aren't built yet.

**Phase 2b: Spend by category**, at `/finance/spending?month=&account=`.

- `monthly_totals` (migration `add_monthly_totals`, which backfills from
  existing transactions) is maintained on every write; see
  [budgets-and-reports.md](budgets-and-reports.md#monthly-totals-the-aggregate-table).
- `GET /reports/spend-by-category?month=&accountId=` → GraphQL
  `spendByCategory(month, accountId): SpendReport` (the sketch's bare
  `[CategorySpend!]!` became an object with totals, income and last month).
- The page leads with the month's total and the change from last month,
  then a horizontal bar per category (this month) with a tick at last
  month's value, a hover/focus tooltip, a table view, and rows that open the
  category's transactions. Colours are the `--viz-*` tokens in `index.css`,
  checked with the palette validator against the card surface in both themes.

**Phase 3: Budgets**, at `/finance/budgets?month=`.

- **A budget carries forward.** A `Budget` row means "from this month on",
  so a limit is set once; the limit for a month is the latest row at or
  before it, and earlier months keep the limit they had. Stopping a budget
  writes a row with `amountMinor = null` (or deletes the row if there was no
  budget before). This replaces the sketch's one-row-per-month model, which
  would need re-entering every budget every month.
- Pure rules in `finance/budget-math.util.ts` (tested): which rule applies,
  rollover over a 12-month window (unspent carries, an overspend never
  does), month progress, pace (`ON_TRACK` / `CLOSE` within 15 points /
  `OVER`).
- "Spent" is `outflow − inflow` from `monthly_totals`, so refunds count in
  a budget's favour. Each line also carries a 3-month average, which
  suggests the amount when setting a budget.
- `GET /budgets?month&today`, `PUT /budgets`, `POST /budgets/remove` →
  GraphQL `budget(month, today)`, `setBudget`, `removeBudget`.
- The page: left to spend, then one bar per budget in its pace's status
  colour (with icon and label) and a tick where "on pace" is today, then
  spending in categories with no budget, each with "Set budget".

**Currencies**, at `/finance/currencies`: currencies in use with one main
currency, daily exchange rates fetched automatically (open.er-api.com, with
a fallback), per-currency overrides, and every total converted to the main
currency. Rules and rate handling: [money-handling.md](money-handling.md#currencies).
Models `Currency` and `ExchangeRate`, `Budget.currency`; migration
`add_currencies`. API `/currencies` (`CurrenciesService`,
`ExchangeRatesService`, pure `currency-math.util.ts`, tested); GraphQL
`currencySettings`, `addCurrency`, `removeCurrency`, `setMainCurrency`,
`setExchangeRateOverride`, `refreshExchangeRates`; `Account.balanceMainMinor`,
and `currency` + `unconverted` on `NetWorth`, `SpendReport`, `BudgetReport`.

**Phase 4: Transfers and CSV import.**

- **Transfers**: "Transfer" on `/finance/transactions`, "Pay off" on cards
  and loans, "Settle up" on IOUs (`TransferDialog`, with the amount owed
  filled in). Two transactions sharing `transferId`, source `"transfer"`,
  each pointing at the other account in `metadata.transferAccountId`;
  neither counts as spending, income or budget use. Across currencies the
  dialog asks for the amount received, pre-filled from today's rate.
  `POST /transactions/transfers`, GraphQL `createTransfer` (idempotent on
  `clientId`) and `Transaction.transferAccount`.
- **CSV import**: "Import CSV" on `/finance/transactions`. Upload, mapping,
  server-side dry-run preview, import; the file is deleted on import or
  cancel and swept after an hour otherwise. See
  [recurring-and-import.md](recurring-and-import.md#csv-import). API
  `POST /imports`, `POST /imports/:id/preview|commit`, `DELETE /imports/:id`;
  BFF upload route `POST /uploads/transactions-csv` and GraphQL
  `previewCsvImport`, `commitCsvImport`, `discardCsvImport`.
- **Gain and loss colours**: amounts show green `+` for money in and red
  `−` for money out; see [frontend.md](frontend.md#money-in-the-ui).

## Scope decisions

- **Single user** in v1, matching the habits module (no `User` entity).
  Several currencies are supported, with totals in one main currency; see
  [money-handling.md](money-handling.md#currencies).
- **No bank API sync** (Open Banking, Plaid, GoCardless) in v1. CSV import
  covers most of the value without OAuth, token storage or provider fees.
- **Not accounting software.** Single-entry transactions, with transfers
  handled as a special case. There's no double-entry ledger.
