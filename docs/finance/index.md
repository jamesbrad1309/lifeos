# Finance Module

A plan for adding personal finance tracking to LifeOS alongside habits:
accounts, transactions, categories, monthly budgets, recurring bills and
savings goals. **Nothing here is built yet.** These docs describe how to
build it on the existing stack without new infrastructure:

- another Nest module next to `habits/`
- another colocated feature folder under `graphql/`
- more models in the same `schema.prisma`
- another view in the web app

## Read in this order

1. [Use cases](use-cases.md): what the module should do, with impact scores
2. [Money handling](money-handling.md): integer minor units, currency, dates (read before touching any amounts)
3. [Data model](data-model.md): Prisma models and why balances are derived
4. [Backend module](backend-module.md): Nest module, services, DTOs, context wiring
5. [GraphQL schema](graphql-schema.md): SDL for `graphql/finance/`
6. [Budgets & reports](budgets-and-reports.md): monthly budgets, spend by category, cash flow
7. [Recurring transactions & CSV import](recurring-and-import.md): getting data in without typing every row
8. [Frontend](frontend.md): components, Apollo queries, formatting money
9. [Habits integration](habits-integration.md): no-spend days, savings streaks, shared XP

## Suggested build order

| Phase | Scope                                                        | Unlocks                           |
| ----- | ------------------------------------------------------------ | --------------------------------- |
| 1     | `Account`, `Category`, `Transaction` + list/create UI        | Manual tracking                   |
| 2     | Derived balances, monthly spend-by-category                  | "Where did my money go?"          |
| 3     | `Budget` + budget-vs-actual view                             | Spending limits                   |
| 4     | CSV import with dedupe                                       | Real bank data in minutes         |
| 5     | `RecurringRule`, `SavingsGoal`                               | Bills and goals                   |
| 6     | Habits integration                                           | Features that span both modules   |

## Scope decisions

- **Single user and single base currency** in v1, matching the habits
  module (no `User` entity). Multi-currency is covered in
  [money-handling.md](money-handling.md) as a later extension.
- **No bank API sync** (Open Banking, Plaid, GoCardless) in v1. CSV import
  covers most of the value without OAuth, token storage or provider fees.
- **Not accounting software.** Single-entry transactions, with transfers
  handled as a special case. There's no double-entry ledger.
