-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CURRENT', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'IOU', 'CASH', 'INVESTMENT');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "institution" TEXT,
    "last4" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "openingBalanceMinor" INTEGER NOT NULL DEFAULT 0,
    "openingBalanceDate" DATE NOT NULL,
    "lastReconciledAt" TIMESTAMP(3),
    "creditLimitMinor" INTEGER,
    "statementDay" INTEGER,
    "paymentDueDay" INTEGER,
    "minPaymentMinor" INTEGER,
    "aprBps" INTEGER,
    "monthlyPaymentMinor" INTEGER,
    "loanStartDate" DATE,
    "termMonths" INTEGER,
    "dueDate" DATE,
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'expense',
    "parentId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "date" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "payee" TEXT,
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transferId" TEXT,
    "importHash" TEXT,
    "clientId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'form',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_parentId_name_key" ON "categories"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_clientId_key" ON "transactions"("clientId");

-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_categoryId_date_idx" ON "transactions"("categoryId", "date");

-- CreateIndex
CREATE INDEX "transactions_transferId_idx" ON "transactions"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_accountId_importHash_key" ON "transactions"("accountId", "importHash");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: Prisma can't express partial indexes.

-- At most one default account among those not archived (archiving clears the flag).
CREATE UNIQUE INDEX "accounts_single_default" ON "accounts" ("isDefault") WHERE "isDefault";

-- @@unique([parentId, name]) doesn't cover top-level categories: Postgres
-- treats NULL parentIds as distinct, so it would allow two "Adjustment"s.
CREATE UNIQUE INDEX "categories_top_level_name_key" ON "categories" ("name") WHERE "parentId" IS NULL;
