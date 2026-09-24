# Finance Module

A plan for adding personal finance tracking to LifeOS alongside habits.
It rests on two ideas:

1. **Set up once, thoroughly.** A single "Money setup" screen covers bank
   accounts, credit cards with their limits, loans and personal debts.
2. **Log in seconds.** Logging a typical expense takes an amount plus one
   tap, because logging every expense by hand is where people give up on
   finance apps.

Categories, budgets, recurring bills, savings goals and reports build on
top of those two. **Nothing here is built yet.** These docs describe how to
build it on the existing stack without new infrastructure:

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
| 1     | Money setup: all account types, derived balances, reconcile  | Cards, limits and debts in one place |
| 2     | Quick log: sheet, chips, presets, undo, "To review" inbox; transaction list | Everyday logging |
| 2b    | Spend by category this month                                 | "Where did my money go?"          |
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
