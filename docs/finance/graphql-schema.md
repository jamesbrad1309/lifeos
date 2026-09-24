# Finance GraphQL Schema

This is the SDL sketch for `apps/api/src/graphql/finance/finance.schema.graphql`.
It extends the root `Query`/`Mutation` in the same way `habits.schema.graphql`
does, and reuses the `JSON` scalar from `root.schema.graphql`.

```graphql
enum AccountType { CURRENT SAVINGS CREDIT_CARD LOAN IOU CASH INVESTMENT }

type Account {
  id: ID!
  name: String!
  type: AccountType!
  currency: String!
  institution: String
  last4: String
  icon: String
  color: String
  sortOrder: Int!
  isDefault: Boolean!
  openingBalanceMinor: Int!
  openingBalanceDate: String!
  lastReconciledAt: String
  """openingBalanceMinor + transactions since openingBalanceDate (DataLoader-batched)."""
  balanceMinor: Int!

  # Credit card
  creditLimitMinor: Int
  statementDay: Int
  paymentDueDay: Int
  minPaymentMinor: Int
  """creditLimitMinor + balanceMinor"""
  availableCreditMinor: Int
  """0–1, owed / limit"""
  utilization: Float
  """YYYY-MM-DD, next paymentDueDay after today"""
  nextDueDate: String
  currentStatementSpendMinor: Int

  # Credit card + loan
  aprBps: Int

  # Loan
  monthlyPaymentMinor: Int
  termMonths: Int
  """YYYY-MM; null if the payment doesn't cover interest"""
  estimatedPayoffMonth: String

  # IOU
  dueDate: String

  archivedAt: String
}

type Category {
  id: ID!
  name: String!
  icon: String
  color: String
  kind: String!
  parent: Category
  children: [Category!]!
}

type Transaction {
  id: ID!
  account: Account!
  category: Category
  """YYYY-MM-DD"""
  date: String!
  """Negative = money out."""
  amountMinor: Int!
  payee: String
  note: String
  tags: [String!]!
  transferId: ID
  isTransfer: Boolean!
  """quick | form | import | recurring | adjustment"""
  source: String!
}

type TransactionPage {
  items: [Transaction!]!
  """Opaque cursor for the next page; null when there are no more rows."""
  nextCursor: String
}

type BudgetLine {
  category: Category!
  """YYYY-MM"""
  month: String!
  limitMinor: Int!
  spentMinor: Int!
  """limitMinor + rollover − spentMinor"""
  remainingMinor: Int!
  """Share of the month elapsed (0–1), for "on pace" colouring."""
  monthProgress: Float!
}

type CategorySpend { category: Category, totalMinor: Int! }
type MonthCashFlow { month: String!, incomeMinor: Int!, expenseMinor: Int! }

type SavingsGoal {
  id: ID!
  name: String!
  targetMinor: Int!
  savedMinor: Int!
  deadline: String
  """Monthly amount needed to hit the deadline, null if no deadline."""
  requiredPerMonthMinor: Int
  onTrack: Boolean
}

input TransactionFilter {
  accountId: ID
  categoryId: ID
  from: String
  to: String
  search: String
  includeTransfers: Boolean = true
  """The quick-log "To review" inbox."""
  uncategorisedOnly: Boolean = false
}

input CreateTransactionInput {
  accountId: ID!
  categoryId: ID
  date: String!
  amountMinor: Int!
  payee: String
  note: String
  tags: [String!]
}

input CreateTransferInput {
  fromAccountId: ID!
  toAccountId: ID!
  date: String!
  """Positive; the service applies the sign to each leg."""
  amountMinor: Int!
}

"""
One flat input for every account type. Which fields are required for which
type is enforced by a zod discriminated union in the DTO, because GraphQL
has no input unions. See account-setup.md.
"""
input AccountInput {
  name: String!
  type: AccountType!
  currency: String
  institution: String
  last4: String
  icon: String
  color: String
  """For cards, loans and IOUs you owe: the amount owed as a POSITIVE number. The service stores it negative."""
  currentBalanceMinor: Int!
  """IOU only: true = you owe them (stored negative), false = they owe you."""
  owedByMe: Boolean
  creditLimitMinor: Int
  statementDay: Int
  paymentDueDay: Int
  minPaymentMinor: Int
  aprBps: Int
  monthlyPaymentMinor: Int
  loanStartDate: String
  termMonths: Int
  dueDate: String
}

type ImportResult { imported: Int!, skippedDuplicates: Int!, errors: [String!]! }

extend type Query {
  accounts: [Account!]!
  netWorthMinor: Int!
  categories: [Category!]!
  transactions(filter: TransactionFilter, first: Int = 50, after: String): TransactionPage!
  budget(month: String!): [BudgetLine!]!
  spendByCategory(month: String!): [CategorySpend!]!
  cashFlow(months: Int = 12): [MonthCashFlow!]!
  upcomingBills(days: Int = 30): [Transaction!]!
  savingsGoals: [SavingsGoal!]!
}

extend type Mutation {
  createAccount(input: AccountInput!): Account!
  updateAccount(id: ID!, input: AccountInput!): Account!
  archiveAccount(id: ID!): Account!
  setDefaultAccount(id: ID!): Account!
  reorderAccounts(ids: [ID!]!): [Account!]!
  """Creates one "Adjustment" transaction for the difference and sets lastReconciledAt."""
  reconcileAccount(id: ID!, actualBalanceMinor: Int!, date: String!): Account!
  createTransaction(input: CreateTransactionInput!): Transaction!
  updateTransaction(id: ID!, input: JSON!): Transaction!
  deleteTransaction(id: ID!): Boolean!
  createTransfer(input: CreateTransferInput!): [Transaction!]!
  upsertBudget(categoryId: ID!, month: String!, amountMinor: Int!): BudgetLine!
  importTransactionsCsv(accountId: ID!, csv: String!, mapping: JSON!): ImportResult!
  createSavingsGoal(input: JSON!): SavingsGoal!
}
```

The `JSON!` inputs above are placeholders to keep the sketch short. Give
them real `input` types when implementing, as `CreateTransactionInput` has.

Quick log has its own query and mutation (`quickLogContext`, `quickLog`),
defined in [quick-log-implementation.md](quick-log-implementation.md).

## Notes

- **Cursor pagination on `transactions`.** This is the first list that can
  grow without bound, unlike habits. Encode `(date, id)` in the cursor and
  order by `date desc, id desc` so paging is stable when several
  transactions share a date.
- **Budget, spend and cash-flow queries take the month from the client**
  (`"2026-09"`). See the Dates section of
  [money-handling.md](money-handling.md).
- **`netWorthMinor`** can overflow 32-bit `Int` for large portfolios. See
  the limit note in money-handling.md.
- **CSV is sent as a string** in a mutation. That's simpler than multipart
  upload through Apollo Server 4, and bank exports are small (under 1 MB).
  Raise the `express.json()` limit in `main.ts` if needed.
- **Resolve every `Date` column to a string explicitly**, as
  `habits.resolvers.ts` does. The default resolver serialises a `Date` into
  a `String` field incorrectly.
