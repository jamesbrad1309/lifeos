# Finance Data Model

These models are added to `apps/api/prisma/schema.prisma` next to `Habit` and
`HabitEntry`. All amounts are integer minor units (see
[money-handling.md](money-handling.md)).

```prisma
enum AccountType {
  CURRENT
  SAVINGS
  CREDIT_CARD
  CASH
  INVESTMENT
  LOAN
}

model Account {
  id                  String      @id @default(uuid())
  name                String
  type                AccountType
  currency            String      @default("GBP") // ISO 4217
  openingBalanceMinor Int         @default(0)
  archivedAt          DateTime?
  metadata            Json        @default("{}") // e.g. saved CSV column mapping
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  transactions Transaction[]
  goals        SavingsGoal[]

  @@map("accounts")
}

model Category {
  id        String     @id @default(uuid())
  name      String
  icon      String?
  color     String?
  kind      String     @default("expense") // "expense" | "income"
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  archivedAt DateTime?
  metadata   Json       @default("{}") // e.g. payee auto-categorisation rules

  transactions Transaction[]
  budgets      Budget[]

  @@unique([parentId, name])
  @@map("categories")
}

model Transaction {
  id          String    @id @default(uuid())
  accountId   String
  account     Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  date        DateTime  @db.Date
  amountMinor Int                      // negative = outflow
  payee       String?
  note        String?
  tags        String[]  @default([])
  /// Both legs of a transfer share this id; excluded from income/expense reports.
  transferId  String?
  /// Set when generated from a RecurringRule.
  recurringRuleId String?
  recurringRule   RecurringRule? @relation(fields: [recurringRuleId], references: [id], onDelete: SetNull)
  /// Hash of (account, date, amount, payee) for CSV-import dedupe.
  importHash  String?
  metadata    Json      @default("{}")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([accountId, importHash])
  @@index([accountId, date])
  @@index([categoryId, date])
  @@index([transferId])
  @@map("transactions")
}

model Budget {
  id          String   @id @default(uuid())
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  month       DateTime @db.Date   // always the 1st of the month
  amountMinor Int                 // positive limit
  rollover    Boolean  @default(false)

  @@unique([categoryId, month])
  @@map("budgets")
}

model RecurringRule {
  id          String    @id @default(uuid())
  accountId   String
  categoryId  String?
  payee       String?
  amountMinor Int
  /// { type: "monthly", dayOfMonth } | { type: "weekly", dayOfWeek } | { type: "yearly", month, day }
  schedule    Json
  startDate   DateTime  @db.Date
  endDate     DateTime? @db.Date
  /// Last date a transaction was generated for — makes generation idempotent.
  lastGeneratedOn DateTime? @db.Date
  active      Boolean   @default(true)

  transactions Transaction[]

  @@map("recurring_rules")
}

model SavingsGoal {
  id          String    @id @default(uuid())
  name        String
  targetMinor Int
  deadline    DateTime? @db.Date
  accountId   String?
  account     Account?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
  /// Optional link to a habit whose check-ins represent contributions.
  habitId     String?
  achievedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@map("savings_goals")
}
```

## Decisions

- **Balances are derived, not stored.** Account balance is
  `openingBalanceMinor + SUM(transactions.amountMinor)`. This follows the
  "derived data" rule in the
  [habit data model](../domain/habit-data-model.md): streaks and points
  aren't stored either. The `(accountId, date)` index keeps it fast at
  personal scale. Add a cached `balanceMinor` only if profiling shows a
  need, and update it in the same `$transaction` as the write.
- **Transfers are two rows with a shared `transferId`.** One row is
  negative on the source account and the other positive on the
  destination. Both are created in one `prisma.$transaction`, and deleting
  one leg deletes both. Reports filter on `transferId: null`, so moving
  money between your own accounts never shows as spending.
- **Category `kind`** separates income categories from expense categories,
  so the UI can offer the right list based on the amount's sign.
- **Splits** (use case, impact 2) are deferred. When they're needed, add a
  `TransactionSplit(transactionId, categoryId, amountMinor)` table and treat
  `Transaction.categoryId` as "use the splits".
- **`importHash` has a unique index scoped to the account**, so re-importing
  the same CSV is a no-op. See
  [recurring-and-import.md](recurring-and-import.md).
- **`String` for `Category.kind`** instead of an enum keeps it flexible,
  like `schedule` JSON on `Habit`. Validation happens in zod DTOs.

## Migration

```bash
pnpm --filter api migrate:dev --name add_finance
```

Then seed the default categories. See [backend-module.md](backend-module.md).
