import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { toIsoDate } from "#finance/calendar.util";

const log = scopedLogger("MonthlyTotalsService");

/** The fields of a transaction that decide which total it lands in and by how much. */
export type TotalsRow = Pick<
  Prisma.TransactionGetPayload<object>,
  "accountId" | "categoryId" | "date" | "amountMinor" | "transferId" | "source"
>;

/** +1 adds a transaction to the totals, -1 takes it back out (delete, or the old side of an edit). */
export type TotalsChange = { row: TotalsRow; sign: 1 | -1 };

interface Delta {
  month: string;
  accountId: string;
  categoryId: string | null;
  outflowMinor: number;
  inflowMinor: number;
  count: number;
}

/**
 * Transfers move money between your own accounts and adjustments correct a
 * balance: neither is spending or income, so neither is counted. The
 * migration's backfill and `rebuild` use the same rule in SQL.
 */
export function isCounted(row: Pick<TotalsRow, "transferId" | "source">): boolean {
  return row.transferId === null && row.source !== "adjustment";
}

/** Sums the changes per (month, account, category), dropping ones that cancel out. */
export function collectDeltas(changes: TotalsChange[]): Delta[] {
  const byKey = new Map<string, Delta>();
  for (const { row, sign } of changes) {
    if (!isCounted(row)) continue;
    const month = `${toIsoDate(row.date).slice(0, 7)}-01`;
    const key = `${month}|${row.accountId}|${row.categoryId ?? ""}`;
    let delta = byKey.get(key);
    if (!delta) {
      delta = {
        month,
        accountId: row.accountId,
        categoryId: row.categoryId,
        outflowMinor: 0,
        inflowMinor: 0,
        count: 0,
      };
      byKey.set(key, delta);
    }
    delta.outflowMinor += sign * Math.max(0, -row.amountMinor);
    delta.inflowMinor += sign * Math.max(0, row.amountMinor);
    delta.count += sign;
  }
  // An edit that changes only the payee adds and removes the same amount.
  return [...byKey.values()].filter(
    (d) => d.outflowMinor !== 0 || d.inflowMinor !== 0 || d.count !== 0,
  );
}

export interface RebuildResult {
  rows: number;
  /** Rows that differed from a fresh recount (0 when the totals were right). */
  drifted: number;
}

/**
 * Owns `monthly_totals`: money in and out per (month, account, category),
 * so reports read a handful of rows instead of summing transactions.
 *
 * Every transaction write calls `apply` with its own transaction client, so
 * the totals change in the same database transaction as the rows they
 * summarise: both commit or neither does. The increments are single
 * `INSERT … ON CONFLICT DO UPDATE` statements, so concurrent writes to the
 * same bucket add up instead of overwriting each other.
 */
@Injectable()
export class MonthlyTotalsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `apply` depends on the NULLS NOT DISTINCT unique index, which Prisma
   * can't express and once dropped as "drift" in a generated migration.
   * Refuse to start without it, rather than failing every transaction write.
   */
  async onModuleInit(): Promise<void> {
    const [index] = await this.prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'monthly_totals' AND indexname = 'monthly_totals_key'`;
    if (!index?.indexdef.includes("NULLS NOT DISTINCT")) {
      throw new Error(
        'monthly_totals_key must be a UNIQUE (month, "accountId", "categoryId") NULLS NOT DISTINCT index; ' +
          "see prisma/migrations/*_restore_monthly_totals_key",
      );
    }
  }

  async apply(tx: Prisma.TransactionClient, changes: TotalsChange[]): Promise<void> {
    for (const d of collectDeltas(changes)) {
      if (d.count > 0) {
        // Only additions reach a bucket with a positive count, so every
        // value here is ≥ 0. (Postgres checks CHECK constraints on the
        // VALUES row before ON CONFLICT turns it into an update, so a
        // negative delta can't take this path even when the row exists.)
        await tx.$executeRaw`
          INSERT INTO "monthly_totals"
            ("id", "month", "accountId", "categoryId", "outflowMinor", "inflowMinor", "transactionCount", "updatedAt")
          VALUES
            (gen_random_uuid()::text, ${d.month}::date, ${d.accountId}, ${d.categoryId},
             ${d.outflowMinor}, ${d.inflowMinor}, ${d.count}, now())
          ON CONFLICT ("month", "accountId", "categoryId") DO UPDATE SET
            "outflowMinor"     = "monthly_totals"."outflowMinor" + EXCLUDED."outflowMinor",
            "inflowMinor"      = "monthly_totals"."inflowMinor" + EXCLUDED."inflowMinor",
            "transactionCount" = "monthly_totals"."transactionCount" + EXCLUDED."transactionCount",
            "updatedAt"        = now()`;
        continue;
      }

      // A removal, or an edit that stayed in its bucket: the row must exist.
      const updated = await tx.$executeRaw`
        UPDATE "monthly_totals" SET
          "outflowMinor"     = "outflowMinor" + ${d.outflowMinor},
          "inflowMinor"      = "inflowMinor" + ${d.inflowMinor},
          "transactionCount" = "transactionCount" + ${d.count},
          "updatedAt"        = now()
        WHERE "month" = ${d.month}::date AND "accountId" = ${d.accountId}
          AND "categoryId" IS NOT DISTINCT FROM ${d.categoryId}`;
      if (updated !== 1) {
        const bucket = `${d.month} / ${d.accountId} / ${d.categoryId ?? "uncategorised"}`;
        throw new Error(
          `monthly_totals has no row for ${bucket}; the totals have drifted: POST /reports/monthly-totals/rebuild`,
        );
      }
      // A bucket whose last transaction left is removed, not kept at zero.
      if (d.count < 0) {
        await tx.$executeRaw`
          DELETE FROM "monthly_totals"
          WHERE "month" = ${d.month}::date AND "accountId" = ${d.accountId}
            AND "categoryId" IS NOT DISTINCT FROM ${d.categoryId}
            AND "transactionCount" = 0`;
      }
    }
  }

  /**
   * Recounts every total from `transactions` and replaces the table, in one
   * transaction. For recovery if the totals ever drift (a CHECK constraint
   * refusing a write is the symptom), and to prove they haven't.
   */
  async rebuild(): Promise<RebuildResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Readers keep seeing the old totals until the new ones commit.
      await tx.$executeRaw`LOCK TABLE "monthly_totals" IN EXCLUSIVE MODE`;
      const [{ drifted }] = await tx.$queryRaw<{ drifted: number }[]>`
        WITH fresh AS (${FRESH_TOTALS})
        SELECT COUNT(*)::int AS drifted
        FROM fresh FULL OUTER JOIN "monthly_totals" t
          ON t."month" = fresh."month" AND t."accountId" = fresh."accountId"
         AND t."categoryId" IS NOT DISTINCT FROM fresh."categoryId"
        WHERE t."id" IS NULL OR fresh."month" IS NULL
           OR t."outflowMinor" <> fresh."outflowMinor"
           OR t."inflowMinor" <> fresh."inflowMinor"
           OR t."transactionCount" <> fresh."transactionCount"`;
      await tx.$executeRaw`DELETE FROM "monthly_totals"`;
      const rows = await tx.$executeRaw`
        INSERT INTO "monthly_totals"
          ("id", "month", "accountId", "categoryId", "outflowMinor", "inflowMinor", "transactionCount", "updatedAt")
        SELECT gen_random_uuid()::text, "month", "accountId", "categoryId",
               "outflowMinor", "inflowMinor", "transactionCount", now()
        FROM (${FRESH_TOTALS}) fresh`;
      return { rows, drifted };
    });
    const level = result.drifted > 0 ? "warn" : "info";
    log[level](result, "monthly totals rebuilt");
    return result;
  }
}

/** What the totals should be, recounted from scratch (the same rules as `isCounted`). */
const FRESH_TOTALS = Prisma.sql`
  SELECT date_trunc('month', "date")::date AS "month",
         "accountId",
         "categoryId",
         SUM(CASE WHEN "amountMinor" < 0 THEN -"amountMinor" ELSE 0 END)::int AS "outflowMinor",
         SUM(CASE WHEN "amountMinor" > 0 THEN "amountMinor" ELSE 0 END)::int AS "inflowMinor",
         COUNT(*)::int AS "transactionCount"
  FROM "transactions"
  WHERE "transferId" IS NULL AND "source" <> 'adjustment'
  GROUP BY 1, 2, 3`;
