# Quick Log: Implementation

How the backend and frontend support the UX in [quick-log.md](quick-log.md).

## One query to open, one mutation to save

The log sheet must render instantly, so everything it needs comes from a
single query. The web app can prefetch it at startup and refetch it after
each save:

```graphql
type QuickPreset {
  id: ID!
  label: String!
  emoji: String
  amountMinor: Int          # null → preset opens the keypad
  category: Category!
  account: Account          # null → default account
}

type QuickLogContext {
  defaultAccount: Account
  accounts: [Account!]!               # in the user's sort order, for the account pill
  suggestedCategories: [Category!]!   # top 6, ranked (see below)
  presets: [QuickPreset!]!
  recentPayees: [String!]!            # for autocomplete + parser
  toReviewCount: Int!                 # uncategorised inbox badge
  lastAccountByCategory: JSON!        # { [categoryId]: accountId }
}

type QuickLogPayload {
  transaction: Transaction!
  """True when this combination has been logged often enough to offer "Save as preset?"."""
  suggestPreset: Boolean!
}

extend type Query {
  """hour/dayOfWeek come from the client, so ranking uses the user's local time."""
  quickLogContext(hour: Int!, dayOfWeek: Int!): QuickLogContext!
}

input QuickLogInput {
  """Client-generated UUID, which makes double taps and offline retries safe."""
  clientId: ID!
  amountMinor: Int!         # positive; isIncome flips the sign
  isIncome: Boolean = false
  categoryId: ID            # null → "To review" inbox
  accountId: ID             # null → default account
  date: String              # YYYY-MM-DD from the client; null → server's today
  payee: String
  note: String
  presetId: ID
}

extend type Mutation {
  quickLog(input: QuickLogInput!): QuickLogPayload!
  createQuickPreset(input: CreateQuickPresetInput!): QuickPreset!
  deleteQuickPreset(id: ID!): Boolean!
}
```

**Undo** uses the existing `deleteTransaction(id)`. No special mutation is
needed.

## Idempotency with `clientId`

`Transaction.clientId String? @unique`. The service **upserts on
`clientId`**. A double tap, a network retry, or a request replayed from an
offline queue then logs one expense, not two:

```ts
// transactions.service.ts (sketch)
quickLog(input: QuickLogInput, defaults: { accountId: string; today: string }) {
  const amountMinor = input.isIncome ? input.amountMinor : -input.amountMinor;
  return this.prisma.transaction.upsert({
    where: { clientId: input.clientId },
    update: {},                                   // already saved → return it unchanged
    create: {
      clientId: input.clientId,
      accountId: input.accountId ?? defaults.accountId,
      categoryId: input.categoryId ?? null,
      date: toDate(input.date ?? defaults.today),
      amountMinor,
      payee: input.payee, note: input.note,
      source: "quick",
    },
  });
}
```

## Ranking suggested categories

This is computed in `quickLogContext` from the last 90 days of the user's
own transactions, with no ML involved:

```
score(category) = Σ over its transactions of
                    recency      × time-of-day match × weekday match
recency          = 0.5 ^ (daysAgo / 14)          # half-life of 2 weeks
time-of-day      = 2 if |loggedHour − hour| ≤ 1 else 1
weekday match    = 1.5 if same weekend/weekday type else 1
```

- `loggedHour` comes from `Transaction.createdAt`, the moment the entry
  was logged. `date` has no time. That's accurate enough, because quick
  logs happen near the purchase. CSV imports and recurring transactions
  are excluded (`source = "quick"` only), since their `createdAt` is
  meaningless for this.
- New users with no history get a fixed starter list: Groceries, Eating
  out, Coffee, Transport, Shopping, Bills.
- 90 days of personal transactions is a few hundred rows. Scoring in
  memory is cheaper than writing SQL for it.

## The one-line parser (frontend, pure function)

```ts
// web/src/lib/quick-log-parse.ts (sketch)
export function parseQuickLog(text: string, ctx: ParseContext): ParsedLog {
  // 1. amount: first token matching /^\d+([.,]\d{1,2})?$/
  // 2. account: token starting with "@", fuzzy-matched to account names
  // 3. category: remaining words matched against, in order,
  //    preset labels → category names/aliases → recentPayees' last category
  // 4. leftover words → payee (if they matched a known payee) or note
}
```

- It runs on every keystroke, and the matched category chip is
  highlighted as a preview.
- It's a pure function with no network calls, so it's easy to unit test
  with a table of `input → expected` cases.
- Category aliases ("coffee", "latte", "starbucks" → Coffee) live in
  `Category.metadata.aliases`, a JSON field that needs no migration.

## Remembering the last account per category

If the user always pays for Fuel on the Amex, quick log should preselect
the Amex when Fuel is tapped. Derive this from the most recent `quick`
transaction in that category. It's a small `DISTINCT ON (categoryId)`
query, returned in the `quickLogContext` payload as
`lastAccountByCategory: JSON`.

## Suggesting presets

After each `quickLog`, check whether this `(payee or note, amountMinor,
categoryId)` combination appears 3 or more times in the last 30 days with
no matching preset. If so, set `suggestPreset: true` on `QuickLogPayload` and
let the frontend offer "Save as preset?". Offer it at most once per
combination, and store dismissals in `Category.metadata`.

## Frontend notes

- **Optimistic UI**: add the new transaction to the cache and show the
  toast immediately. The `clientId` makes retrying the mutation safe.
- **Keypad**: use a custom on-screen keypad on touch devices so the OS
  keyboard doesn't cover the chips, and a normal `<input inputMode="decimal">`
  with the same parser on desktop.
- **Offline (later)**: queue `QuickLogInput`s in IndexedDB and replay them
  on reconnect. `clientId` makes the replay idempotent.
- **Measure it**: record time from opening the sheet to saving on the client,
  and send it as an optional `durationMs` on `QuickLogInput`, logged at `debug`.
  If the median goes above 5s, the flow has gained friction.
