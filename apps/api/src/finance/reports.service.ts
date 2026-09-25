import { Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import { toMainMinor } from "#finance/currency-math.util";

export interface CategorySpend {
  /** Null: uncategorised ("To review"). */
  category: Category | null;
  /** Out minus refunds in: what this category cost this month. */
  spentMinor: number;
  previousSpentMinor: number;
  transactionCount: number;
}

export interface SpendReport {
  /** "YYYY-MM" */
  month: string;
  /** The main currency every figure is converted into. */
  currency: string;
  /** Currencies left out because there's no rate for them yet. */
  unconverted: string[];
  spentMinor: number;
  previousSpentMinor: number;
  /** Net money in under income categories. */
  incomeMinor: number;
  /** Biggest spend first. */
  categories: CategorySpend[];
}

/** The date a month's figures convert at: its last day, or today while it's still going. */
export function rateDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return lastDay < today ? lastDay : today;
}

/** "2026-09" → "2026-08". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 2, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Reports over `monthly_totals` (see MonthlyTotalsService): a month is a few
 * dozen pre-summed rows, however many transactions it holds.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
  ) {}

  /**
   * Spend per category for a month, next to the month before. Refunds
   * (money in under an expense category) reduce that category's spend;
   * income categories count towards `incomeMinor` instead.
   */
  async spendByCategory(month: string, accountId?: string): Promise<SpendReport> {
    const previous = previousMonth(month);
    const rows = await this.prisma.monthlyTotal.findMany({
      where: {
        month: { in: [fromIsoDate(`${month}-01`), fromIsoDate(`${previous}-01`)] },
        ...(accountId ? { accountId } : {}),
      },
      include: { category: true, account: { select: { currency: true } } },
    });
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();

    const byCategory = new Map<string | null, CategorySpend>();
    let incomeMinor = 0;
    for (const row of rows) {
      const current = row.month.toISOString().startsWith(month);
      // Each month converts at its own rate: its last day's, or today's if it isn't over.
      const net = toMainMinor(
        ctx,
        row.outflowMinor - row.inflowMinor,
        row.account.currency,
        rateDate(toIsoDate(row.month).slice(0, 7)),
      );
      if (net === null) {
        unconverted.add(row.account.currency);
        continue;
      }
      if (row.category?.kind === "income") {
        if (current) incomeMinor -= net;
        continue;
      }
      let entry = byCategory.get(row.categoryId);
      if (!entry) {
        entry = {
          category: row.category,
          spentMinor: 0,
          previousSpentMinor: 0,
          transactionCount: 0,
        };
        byCategory.set(row.categoryId, entry);
      }
      if (current) {
        entry.spentMinor += net;
        entry.transactionCount += row.transactionCount;
      } else {
        entry.previousSpentMinor += net;
      }
    }

    const categories = [...byCategory.values()]
      .filter((c) => c.transactionCount > 0 || c.previousSpentMinor !== 0)
      .sort((a, b) => b.spentMinor - a.spentMinor || b.previousSpentMinor - a.previousSpentMinor);
    return {
      month,
      currency: ctx.main,
      unconverted: [...unconverted].sort(),
      spentMinor: categories.reduce((sum, c) => sum + c.spentMinor, 0),
      previousSpentMinor: categories.reduce((sum, c) => sum + c.previousSpentMinor, 0),
      incomeMinor,
      categories,
    };
  }
}
