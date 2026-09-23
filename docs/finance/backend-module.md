# Finance Backend Module

The module follows the same split as habits (see
[nestjs-structure.md](../backend/nestjs-structure.md)): **standard Nest
modules** hold services and DTOs, and **`graphql/finance/`** holds the
colocated SDL and resolvers.

## Layout

```
apps/api/src/
├── finance/
│   ├── finance.module.ts          # providers + exports for all services below
│   ├── accounts.service.ts
│   ├── transactions.service.ts    # create/update/delete, transfers, filters
│   ├── categories.service.ts      # includes seedDefaults()
│   ├── budgets.service.ts         # budget vs actual (see budgets-and-reports.md)
│   ├── reports.service.ts         # groupBy aggregates
│   ├── recurring.service.ts       # rule → transaction generation
│   ├── import.service.ts          # CSV parse + dedupe
│   ├── money.util.ts              # pure helpers: sumMinor, monthRange("2026-09")
│   ├── finance.loader.ts          # per-request DataLoaders
│   └── dto/
│       ├── create-transaction.dto.ts
│       ├── create-transfer.dto.ts
│       ├── upsert-budget.dto.ts
│       └── …
└── graphql/
    └── finance/
        ├── finance.schema.graphql
        └── finance.resolvers.ts
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

## Wiring into the GraphQL context

Three places change, the same ones habits used:

1. `app.module.ts`: add `FinanceModule` to `imports`.
2. `main.ts`: `app.get(TransactionsService)` etc., passed to `buildContext`.
3. `graphql/context.ts`: extend `GraphQLContext` / `ContextDeps` with the
   finance services and loaders.

If the list of injected services grows unwieldy, pass a single
`FinanceFacade` that exposes the finance services. That keeps `ContextDeps`
short.

`graphql/schema.ts` already globs `**/*.graphql` and `**/*.resolvers.*`, so
**`graphql/finance/` is picked up automatically** with no registry to edit.

## DataLoaders

Resolving `Account.balanceMinor` for every account in a list would run one
query per account. Batch it the way `habit-entries.loader.ts` does:

```ts
// finance.loader.ts (sketch)
export const createBalanceLoader = (prisma: PrismaService) =>
  new DataLoader<string, number>(async (accountIds) => {
    const sums = await prisma.transaction.groupBy({
      by: ["accountId"],
      where: { accountId: { in: [...accountIds] } },
      _sum: { amountMinor: true },
    });
    const byId = new Map(sums.map((s) => [s.accountId, s._sum.amountMinor ?? 0]));
    return accountIds.map((id) => byId.get(id) ?? 0);
  });
```

The resolver adds `openingBalanceMinor` to the loaded sum. The same pattern
works for `Category.spentThisMonth` and `Budget.spentMinor`.

## Seeding default categories

Put `CategoriesService.seedDefaults()` in `onModuleInit` and make it a
no-op when any category already exists. There's no separate seed script to
remember, and it's idempotent across restarts and in Docker.

## Logging

Follow [logging.md](../backend/logging.md): use `scopedLogger("TransactionsService")`
and log ids and amounts. **Don't log payee or note text at `info`.** It's
personal financial data, so keep it at `debug` or leave it out.
