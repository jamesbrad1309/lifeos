# Finance Backend Module

The module follows the same split as habits:

- **`apps/api`**: a Nest `FinanceModule` with REST controllers, services,
  DTOs and all the money logic. See [nestjs-structure.md](../backend/nestjs-structure.md).
- **`apps/bff`**: `graphql/finance/`, with the colocated SDL and resolvers
  that call those REST endpoints. See [graphql-bff.md](../backend/graphql-bff.md).

## Layout

```
apps/api/src/
├── finance/
│   ├── finance.module.ts          # providers + exports for all services below
│   ├── accounts.service.ts        # setup, default account, reorder, reconcile, derived card/loan values
│   ├── quick-log.service.ts       # quickLogContext ranking, quickLog upsert, presets
│   ├── transactions.service.ts    # create/update/delete, transfers, filters
│   ├── categories.service.ts      # includes seedDefaults()
│   ├── budgets.service.ts         # budget vs actual (see budgets-and-reports.md)
│   ├── reports.service.ts         # groupBy aggregates
│   ├── recurring.service.ts       # rule → transaction generation
│   ├── import.service.ts          # CSV parse + dedupe
│   ├── money.util.ts              # pure helpers: sumMinor, monthRange("2026-09")
│   ├── *.controller.ts            # REST: accounts, transactions, budgets, quick-log, reports
│   └── dto/
│       ├── create-transaction.dto.ts
│       ├── create-transfer.dto.ts
│       ├── upsert-budget.dto.ts
│       └── …

apps/bff/src/graphql/
├── finance/
│   ├── finance.schema.graphql     # see graphql-schema.md
│   └── finance.resolvers.ts       # ctx.api.get("/accounts") etc.
└── loaders.ts                     # + accountBalance, categorySpend loaders
```

The finance services live in one `FinanceModule`, not a module per entity.
The entities are tightly coupled (budgets need transactions, reports need
everything). Split it later if the module grows.

## Adding the `#finance/*` alias

`apps/api/package.json` `imports` needs a new entry, in the same shape as the
existing ones (see
[typescript-import-aliases.md](../shared/typescript-import-aliases.md)):

```json
"#finance/*": {
  "types": "./src/finance/*.ts",
  "default": "./dist/finance/*.js"
}
```

## DTOs: zod, like habits

```ts
// finance/dto/create-transaction.dto.ts (sketch)
import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  date: isoDate,
  amountMinor: z.number().int().refine((n) => n !== 0, "amount can't be zero"),
  payee: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
```

`z.number().int()` rejects `12.34` at the API boundary. That makes the
float-vs-minor-units mistake a validation error instead of silent data
corruption.

## Transfers must be atomic

```ts
// transactions.service.ts (sketch)
async createTransfer(input: CreateTransferInput) {
  const transferId = randomUUID();
  const [out, into] = await this.prisma.$transaction([
    this.prisma.transaction.create({ data: {
      accountId: input.fromAccountId, date: toDate(input.date),
      amountMinor: -input.amountMinor, transferId, payee: "Transfer" } }),
    this.prisma.transaction.create({ data: {
      accountId: input.toAccountId, date: toDate(input.date),
      amountMinor: input.amountMinor, transferId, payee: "Transfer" } }),
  ]);
  log.info({ transferId, amountMinor: input.amountMinor }, "transfer created");
  return { out, into };
}
```

Delete both legs with `deleteMany({ where: { transferId } })`.

## REST endpoints and BFF wiring

**API side** (`apps/api`): add `FinanceModule` to `app.module.ts` `imports`.
Its controllers expose resource-shaped endpoints, for example:

| Endpoint | Used by |
| -------- | ------- |
| `GET /accounts`, `POST /accounts`, `PATCH /accounts/:id`, `POST /accounts/:id/reconcile` | Money setup |
| `GET /accounts/balances?ids=a,b` | **Batch**: the BFF's `accountBalance` loader |
| `GET /transactions?…filter&cursor`, `POST /transactions`, `DELETE /transactions/:id` | Transaction list, undo |
| `POST /transfers` | Transfers, card payments |
| `GET /quick-log/context?hour=8&dayOfWeek=3`, `POST /quick-log` | Quick log |
| `GET /budgets/:month`, `GET /reports/spend-by-category/:month`, `GET /reports/cash-flow?months=12` | Budgets, reports |

**BFF side** (`apps/bff`): add `graphql/finance/`. `graphql/schema.ts`
already globs `**/*.graphql` and `**/*.resolvers.js`, so the folder is
**picked up automatically**. Add the response shapes to
`clients/api-types.ts`. Nothing else is wired by hand: resolvers use
`ctx.api` and `ctx.loaders`, which exist on every request.

## Batching: API batch endpoint + BFF DataLoader

Resolving `Account.balanceMinor` for every account in a list would make one
HTTP call per account. Use the same pattern as habit stats: one **batch
endpoint in the API** and one **DataLoader in the BFF**.

```ts
// apps/api — accounts.service.ts (sketch): one groupBy for any number of accounts
async balances(accountIds: string[]) {
  const [accounts, sums] = await Promise.all([
    this.prisma.account.findMany({ where: { id: { in: accountIds } } }),
    this.prisma.transaction.groupBy({
      by: ["accountId"],
      where: { accountId: { in: accountIds } },
      _sum: { amountMinor: true },
    }),
  ]);
  const byId = new Map(sums.map((s) => [s.accountId, s._sum.amountMinor ?? 0]));
  return accounts.map((a) => ({
    accountId: a.id,
    balanceMinor: a.openingBalanceMinor + (byId.get(a.id) ?? 0),
  }));
}
```

```ts
// apps/bff — graphql/loaders.ts (sketch)
accountBalance: new DataLoader(async (ids) => {
  const rows = await api.get<ApiAccountBalance[]>(`/accounts/balances?ids=${idsParam(ids)}`);
  const byId = new Map(rows.map((r) => [r.accountId, r.balanceMinor]));
  return ids.map((id) => byId.get(id) ?? new Error(`No balance for account ${id}`));
}),
```

Derived card and loan values (available credit, utilisation, next due date,
payoff month) are computed **in the API** next to the balance, and returned
by the same batch endpoint. They're domain rules, so they don't belong in
BFF resolvers. The same pattern works for `Category.spentThisMonth` and
`Budget.spentMinor`.

The balance query sums **all** of an account's transactions, while balances
are defined as "since `openingBalanceDate`" (see
[account-setup.md](account-setup.md)). The two agree as long as the DTOs
**reject any transaction dated before its account's `openingBalanceDate`**.
Enforce that in `TransactionsService`, and the query stays a simple
`groupBy`.

## Seeding default categories

Put `CategoriesService.seedDefaults()` in `onModuleInit` and make it a
no-op when any category already exists. There's no separate seed script to
remember, and it's idempotent across restarts and in Docker.

The built-in **"Adjustment"** category (`isSystem: true`) is the exception.
`reconcileAccount` depends on it, so **upsert it on every start** rather
than only when the table is empty. Otherwise a database that already has
categories never gets it.

## Logging

Follow [logging.md](../backend/logging.md): use `scopedLogger("TransactionsService")`
and log ids and amounts. **Don't log payee or note text at `info`.** It's
personal financial data, so keep it at `debug` or leave it out.
