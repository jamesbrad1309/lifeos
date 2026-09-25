-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP';

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "overrideToMain" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "date" DATE NOT NULL,
    "code" TEXT NOT NULL,
    "perUsd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("date","code")
);

-- CreateIndex
CREATE INDEX "exchange_rates_code_date_idx" ON "exchange_rates"("code", "date");

-- Hand-written: what Prisma can't express.

-- Exactly one main currency (at most one here; CurrenciesService makes sure there is one).
CREATE UNIQUE INDEX "currencies_single_main" ON "currencies" ("isMain") WHERE "isMain";
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_iso_code" CHECK ("code" ~ '^[A-Z]{3}$');
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_positive_override" CHECK ("overrideToMain" IS NULL OR "overrideToMain" > 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_positive" CHECK ("perUsd" > 0);

-- Start from the currencies accounts already use; the most used one is main.
INSERT INTO "currencies" ("code", "isMain", "sortOrder")
SELECT "currency", ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, "currency") = 1, (ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, "currency"))::int - 1
FROM "accounts"
GROUP BY "currency";
