# Habits × Finance Integration

These features only work because both modules live in one app. They're
listed as use cases under "Cross-module" in
[domain/use-cases.md](../domain/use-cases.md).

## 1. "No-spend day" habit, auto-checked

A habit whose entries are **derived from transactions** instead of logged
by hand.

- Mark the habit with `metadata: { source: "finance.noSpend", categoryIds?: [...] }`.
  The existing `metadata` JSON column needs no migration.
- A day counts as successful when there are no outflow transactions that
  day, excluding transfers, optionally limited to "discretionary"
  categories so rent doesn't break the streak.
- **Implementation:** when a transaction is created, updated or deleted,
  `TransactionsService` calls `HabitEntriesService.upsert` for linked
  habits on that date. Streak, points and heatmap logic then keep working
  unchanged because they only read `HabitEntry`.
- Dependency direction: `FinanceModule` imports `HabitEntriesModule`, not
  the other way round, so the habits module stays unaware of finance.

The heatmap then shows no-spend days for free.

## 2. Savings goal as a habit

"Save £10 a day towards Japan":

- A `SavingsGoal` with `habitId` set, and a habit with `unit: "£"` and
  `targetValue: 10`.
- Checking the habit off with a value can **optionally create a transfer**
  from the current account to the goal's savings account. That's opt-in,
  with a checkbox in the check-in UI.
- `SavingsGoal.savedMinor` is the balance of the linked account, or the sum
  of the linked habit's entry values when there's no linked account.

## 3. Cost of a habit

Link a habit to one or more spending categories
(`metadata.financeCategoryIds`). Then show, on the `HabitCard`:

- "Coffee (avoid): 12-day streak · spent £3.40 this month vs £48 last month"
- For positive habits such as "Gym": cost per check-in, meaning the
  membership fee divided by visits this month. It's a good motivator.

This is a read-only `Habit.linkedSpendMinor(month)` field resolved through
the finance `ReportsService`.

## 4. Unified LifeOS XP

Extend `gamification.util.ts` with finance sources, keeping the rule that
XP is derived and never stored:

| Event                                           | XP   |
| ----------------------------------------------- | ---- |
| Habit check-in (existing)                       | 10   |
| Day of current streak (existing)                | 5    |
| Category finished the month under budget        | 25   |
| Savings goal reached                            | 100  |
| Transactions logged or imported that week (consistency) | 10   |

`dashboardStats` gains a `lifeLevel` computed from habit XP plus finance
XP. Keep the per-module numbers visible so it's clear where the XP came
from.

## 5. "Log today's spending" habit

This turns the logging routine itself into a habit, which is the most
direct fix for "I forget to log":

- A habit with `metadata: { source: "finance.loggedToday" }`, `startTime: "21:00"`,
  shown in the day view like any other habit.
- Tapping it in the day view **opens quick log** in evening catch-up mode
  (see [quick-log.md](quick-log.md)) instead of just ticking it.
- It's auto-checked, the same way as the no-spend habit in §1, once at
  least one `quick` or `form` transaction exists for that date. **Reconcile
  also counts**, because updating balances is a valid way to keep finances
  accurate.
- The streak then rewards the logging routine, and it uses the existing
  streak, points and heatmap code unchanged.

## Guardrails

- **Never block a finance write on a habits side effect.** If the no-spend
  upsert fails, log it and continue. The transaction is the source of
  truth, and the habit entry can be recomputed.
- Provide a `recomputeDerivedHabitEntries(habitId)` mutation to rebuild
  auto-checked entries from transactions after bulk imports or bug fixes.
