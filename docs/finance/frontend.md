# Finance Frontend

This builds on the existing web app (see [stack.md](../frontend/stack.md),
[shadcn-setup.md](../frontend/shadcn-setup.md)): React 19, Apollo Client,
shadcn/ui, Tailwind and `#` import aliases.

## Navigation

`App.tsx` currently switches between `"dashboard"` and `"day"` with
`useState<View>`. Finance adds a third top-level area. At that point it's
worth moving to a router so URLs like `/finance/transactions?month=2026-09`
can be shared and bookmarked. If routing waits, add a `"finance"` value to
`View` and keep finance sub-tabs in local state.

## Components

```
apps/web/src/
├── components/finance/
│   ├── FinanceOverview.tsx       # net worth, account balances, this month's cash flow
│   ├── AccountList.tsx
│   ├── TransactionList.tsx       # paginated, grouped by date, filter bar
│   ├── TransactionForm.tsx       # dialog: amount, sign toggle, category, date, payee
│   ├── QuickAddExpense.tsx       # amount + category chips, also used on the habits dashboard
│   ├── TransferDialog.tsx
│   ├── BudgetView.tsx            # month picker + BudgetRow list
│   ├── BudgetRow.tsx             # Progress bar with pace colour
│   ├── SpendByCategoryChart.tsx
│   ├── CashFlowChart.tsx
│   ├── SavingsGoalCard.tsx
│   └── CsvImportDialog.tsx       # file → preview → column mapping → import
├── graphql/finance.ts            # gql documents + fragments
└── lib/money.ts                  # formatMoney / parseMoneyInput
```

Existing shadcn components cover most of this: `Card`, `Dialog`, `Input`,
`Label`, `Badge`, `Progress`, `Button`. Add these with the shadcn CLI:
`select` (account/category pickers), `table` (transaction list), `tabs`
(finance sub-views), `popover` + `calendar` (date picker).

## Money in the UI

- **Only `lib/money.ts` converts** between minor units and display
  strings. Components receive `amountMinor: number` and call
  `formatMoney`.
- **Amount input**: use `inputMode="decimal"` with a separate "Expense /
  Income" toggle for the sign. People type "12.50", not "-1250". Convert on
  submit.
- Show outflows in the default foreground colour and inflows in green.
  Avoid making every expense red, because a list where most rows are red
  looks alarming.

## Apollo

- Use a `TransactionFields` fragment, like `HabitFields` in
  `graphql/habits.ts`.
- **Pagination**: configure a `typePolicies` field policy for
  `Query.transactions` keyed on `filter` that merges pages by cursor, so
  "Load more" appends instead of replacing.
- **After a write**, refetch `accounts` (balances) and `budget(month)` (spent
  amounts). They're derived server-side, so there's nothing to update
  optimistically in the cache beyond the new transaction itself.
  `refetchQueries: ["Accounts", "Budget"]` is enough at this scale.

## Charts

The web app doesn't have a charting library yet. Recharts fits React and
Tailwind well. shadcn's `chart` component wraps it, so
`npx shadcn add chart` adds it in the project's style. Use a donut or
horizontal bar for spend by category and grouped bars for cash flow. Reuse
`Category.color` for series colours so a category looks the same everywhere.
