-- Prisma can't express CHECK constraints.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_first_of_month" CHECK (EXTRACT(DAY FROM "month") = 1),
  ADD CONSTRAINT "budgets_positive_amount" CHECK ("amountMinor" IS NULL OR "amountMinor" > 0);
