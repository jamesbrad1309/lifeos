-- 20260925135036_add_budgets dropped this index: Prisma saw a unique index
-- it couldn't express (NULLS NOT DISTINCT) and "fixed" the drift. The schema
-- now declares it (map: "monthly_totals_key"), so it won't be dropped again.
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_totals_key"
  ON "monthly_totals" ("month", "accountId", "categoryId") NULLS NOT DISTINCT;
