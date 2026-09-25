-- CreateTable
CREATE TABLE "monthly_totals" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "outflowMinor" INTEGER NOT NULL DEFAULT 0,
    "inflowMinor" INTEGER NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_totals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_totals_month_idx" ON "monthly_totals"("month");

-- AddForeignKey
ALTER TABLE "monthly_totals" ADD CONSTRAINT "monthly_totals_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_totals" ADD CONSTRAINT "monthly_totals_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: what Prisma can't express.

-- One row per (month, account, category). NULLS NOT DISTINCT (Postgres 15+)
-- makes "uncategorised" a single bucket too, so INSERT ... ON CONFLICT can
-- increment it like any other row.
CREATE UNIQUE INDEX "monthly_totals_key" ON "monthly_totals" ("month", "accountId", "categoryId") NULLS NOT DISTINCT;

-- Totals only ever come from adding and subtracting real transactions, so a
-- negative one means they've drifted: fail the write loudly instead of
-- reporting wrong numbers. POST /reports/monthly-totals/rebuild recovers.
ALTER TABLE "monthly_totals"
  ADD CONSTRAINT "monthly_totals_non_negative"
  CHECK ("outflowMinor" >= 0 AND "inflowMinor" >= 0 AND "transactionCount" >= 0),
  ADD CONSTRAINT "monthly_totals_first_of_month"
  CHECK (EXTRACT(DAY FROM "month") = 1);

-- Backfill from existing transactions (the same rules as MonthlyTotalsService).
INSERT INTO "monthly_totals" ("id", "month", "accountId", "categoryId", "outflowMinor", "inflowMinor", "transactionCount", "updatedAt")
SELECT gen_random_uuid()::text,
       date_trunc('month', "date")::date,
       "accountId",
       "categoryId",
       SUM(CASE WHEN "amountMinor" < 0 THEN -"amountMinor" ELSE 0 END)::int,
       SUM(CASE WHEN "amountMinor" > 0 THEN "amountMinor" ELSE 0 END)::int,
       COUNT(*)::int,
       now()
FROM "transactions"
WHERE "transferId" IS NULL AND "source" <> 'adjustment'
GROUP BY 2, 3, 4;
