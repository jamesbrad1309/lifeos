# Finance Frontend

This builds on the existing web app (see [stack.md](../frontend/stack.md),
[shadcn-setup.md](../frontend/shadcn-setup.md)): React 19, Apollo Client,
shadcn/ui, Tailwind and `#` import aliases.

## Navigation

The web app uses TanStack Router ([app-shell.md](../frontend/app-shell.md)).
Finance routes live under `src/routes/finance/`: `/finance/accounts` is
Money setup, and `/finance` redirects there until an overview exists. Future
screens follow the same shape, with filters as validated search params, e.g.
`/finance/transactions?month=2026-09`.

Quick log's deep link (`/log?amount=3.40&category=coffee`, see
[quick-log.md](quick-log.md)) can be a route whose `validateSearch` reads
the amount and category and opens the sheet.

Suggested finance screens:

| Screen | Purpose |
| ------ | ------- |
| **Money setup** | Configure accounts, cards, loans and IOUs ([account-setup.md](account-setup.md)) |
| **Transactions** | Full list, filters, the "To review" inbox |
| **Budgets** | Budget vs actual for a month |
| **Reports** | Charts |

Quick log isn't a screen. It's a **sheet** that opens over any screen.

## Components

```
apps/web/src/
├── components/finance/
│   ├── setup/
│   │   ├── MoneySetup.tsx        # net-worth header + accounts grouped by type, drag to reorder
│   │   ├── AccountRow.tsx        # balance; utilisation bar + due date for cards; payoff for loans
│   │   ├── AccountForm.tsx       # one dialog, fields switch on the chosen type
│   │   └── ReconcileDialog.tsx   # "Update balance" → reconcileAccount
│   ├── quick-log/
│   │   ├── QuickLogButton.tsx    # floating ➕, mounted once in App.tsx on every screen
│   │   ├── QuickLogSheet.tsx     # amount, pills, chips, presets; tap chip = save
│   │   ├── AmountKeypad.tsx      # on-screen keypad for touch devices
│   │   ├── CategoryChips.tsx
│   │   ├── PresetRow.tsx
│   │   └── UndoToast.tsx
│   ├── FinanceOverview.tsx       # net worth, account balances, this month's cash flow
│   ├── TransactionList.tsx       # paginated, grouped by date, filter bar, "To review" tab
│   ├── TransactionForm.tsx       # full form: payee, note, tags, any date, splits later
│   ├── TransferDialog.tsx        # also used for "Pay off card" and "Settle up"
│   ├── BudgetView.tsx            # month picker + BudgetRow list
│   ├── BudgetRow.tsx             # Progress bar with pace colour
│   ├── SpendByCategoryChart.tsx
│   ├── CashFlowChart.tsx
│   ├── SavingsGoalCard.tsx
│   └── CsvImportDialog.tsx       # file → preview → column mapping → import
├── graphql/finance.ts            # gql documents + fragments
├── hooks/useQuickLog.ts          # quickLogContext query, quickLog mutation, optimistic update, undo
└── lib/
    ├── money.ts                  # formatMoney / parseMoneyInput
    └── quick-log-parse.ts        # one-line parser, pure + unit-tested
```

Existing shadcn components cover most of this: `Card`, `Dialog`, `Input`,
`Label`, `Badge`, `Progress`, `Button`. Add these with the shadcn CLI:
`select` (account/category pickers), `table` (transaction list), `tabs`
(finance sub-views), `popover` + `calendar` (date picker), `sheet` or
`drawer` (quick log, a bottom sheet on mobile), and `sonner` (the undo
toast).

## Money in the UI

- **Only `lib/money.ts` converts** between minor units and display
  strings. Components receive `amountMinor: number` and call
  `formatMoney`.
- **Amount input**: use `inputMode="decimal"` with a separate "Expense /
  Income" toggle for the sign. People type "12.50", not "-1250". Convert on
  submit.
- **Gain or loss is coloured.** `<Amount minor currency />`
  (`components/finance/Amount.tsx`) shows money in as green `+£12.50` and
  money out as red `−£12.50`. The sign is always there, so the meaning
  never rests on colour alone. Use `tone="neutral"` for transfers: money
  moving between your own accounts is neither.
- For numbers that aren't a transaction, use `moneyToneClass()` or
  `MONEY_IN_CLASS` / `MONEY_OUT_CLASS`:
  - balances stay plain unless they're owed (cards, loans, "you owe") or
    overdrawn, which are red; money someone owes you is green;
  - net worth and group subtotals are red only when negative;
  - spending compared with last month: more is red, less is green;
  - a budget that's over is red;
  - the reconcile adjustment is signed and coloured.

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
