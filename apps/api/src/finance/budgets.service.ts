import { BadRequestException, Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import {
  type BudgetMonth,
  type BudgetRule,
  type Pace,
  ROLLOVER_WINDOW_MONTHS,
  budgetMonth,
  monthProgress,
  pace,
  ruleFor,
  shiftMonth,
} from "#finance/budget-math.util";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import { toMainMinor } from "#finance/currency-math.util";
import type { SetBudgetInput } from "#finance/dto/budget.dto";
import { rateDate } from "#finance/reports.service";

const log = scopedLogger("BudgetsService");

/** Months averaged for "you usually spend…". */
const AVERAGE_MONTHS = 3;

export interface BudgetLine extends BudgetMonth {
  category: Category;
  pace: Pace;
  /** Average monthly spend over the 3 months before, to judge the limit by. */
  averageSpentMinor: number;
}

export interface UnbudgetedSpend {
  /** Null: uncategorised. */
  category: Category | null;
  spentMinor: number;
  averageSpentMinor: number;
}

export interface BudgetReport {
  month: string;
  /** The main currency every amount is in. */
  currency: string;
  /** Currencies whose spending was left out for want of a rate. */
  unconverted: string[];
  /** 0–1: how much of the month has gone, in the user's calendar. */
  monthProgress: number;
  lines: BudgetLine[];
  /** Spending this month in categories without a budget, biggest first. */
  unbudgeted: UnbudgetedSpend[];
  totals: { availableMinor: number; spentMinor: number; remainingMinor: number };
}

/**
 * Budgets are rules that carry forward (see the `Budget` model); "spent"
 * comes from `monthly_totals`, so a whole year of rollover is one small
 * query rather than a scan of transactions.
 */
@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
  ) {}

  async report(month: string, today: string): Promise<BudgetReport> {
    const windowStart = shiftMonth(month, -(ROLLOVER_WINDOW_MONTHS - 1));
    const [rows, totals, categories] = await Promise.all([
      this.prisma.budget.findMany({
        where: { month: { lte: fromIsoDate(`${month}-01`) } },
        orderBy: { month: "asc" },
      }),
      this.prisma.monthlyTotal.findMany({
        where: {
          month: { gte: fromIsoDate(`${windowStart}-01`), lte: fromIsoDate(`${month}-01`) },
        },
        select: {
          month: true,
          categoryId: true,
          outflowMinor: true,
          inflowMinor: true,
          account: { select: { currency: true } },
        },
      }),
      this.prisma.category.findMany({ where: { isSystem: false } }),
    ]);
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();

    // Net spend (out − refunds) per category per month, summed over accounts
    // in the main currency, each month at its own rate.
    const spent = new Map<string, number>();
    const key = (categoryId: string | null, m: string) => `${categoryId ?? ""}|${m}`;
    for (const t of totals) {
      const m = toIsoDate(t.month).slice(0, 7);
      const net = toMainMinor(ctx, t.outflowMinor - t.inflowMinor, t.account.currency, rateDate(m));
      if (net === null) {
        unconverted.add(t.account.currency);
        continue;
      }
      const k = key(t.categoryId, m);
      spent.set(k, (spent.get(k) ?? 0) + net);
    }
    const spentIn = (categoryId: string | null) => (m: string) =>
      spent.get(key(categoryId, m)) ?? 0;
    const average = (categoryId: string | null) => {
      let sum = 0;
      for (let back = 1; back <= AVERAGE_MONTHS; back++)
        sum += spentIn(categoryId)(shiftMonth(month, -back));
      return Math.round(sum / AVERAGE_MONTHS);
    };

    const rulesByCategory = new Map<string, BudgetRule[]>();
    for (const row of rows) {
      const list = rulesByCategory.get(row.categoryId) ?? [];
      // A limit set in another main currency converts at this report
      // month's rate (for the whole rollover window, a simplification).
      const amountMinor =
        row.amountMinor === null
          ? null
          : (toMainMinor(ctx, row.amountMinor, row.currency, rateDate(month)) ?? row.amountMinor);
      list.push({ month: toIsoDate(row.month).slice(0, 7), amountMinor, rollover: row.rollover });
      rulesByCategory.set(row.categoryId, list);
    }

    const progress = monthProgress(month, today);
    const lines: BudgetLine[] = [];
    const unbudgeted: UnbudgetedSpend[] = [];
    for (const category of categories) {
      if (category.kind !== "expense") continue;
      const b = budgetMonth(rulesByCategory.get(category.id) ?? [], spentIn(category.id), month);
      if (b) {
        lines.push({
          ...b,
          category,
          pace: pace(b.spentMinor, b.availableMinor, progress),
          averageSpentMinor: average(category.id),
        });
      } else if (spentIn(category.id)(month) > 0) {
        unbudgeted.push({
          category,
          spentMinor: spentIn(category.id)(month),
          averageSpentMinor: average(category.id),
        });
      }
    }
    const uncategorised = spentIn(null)(month);
    if (uncategorised > 0) {
      unbudgeted.push({
        category: null,
        spentMinor: uncategorised,
        averageSpentMinor: average(null),
      });
    }

    // Furthest through its budget first: what needs attention leads.
    lines.sort(
      (a, b) =>
        b.spentMinor / Math.max(1, b.availableMinor) -
          a.spentMinor / Math.max(1, a.availableMinor) ||
        a.category.name.localeCompare(b.category.name),
    );
    unbudgeted.sort((a, b) => b.spentMinor - a.spentMinor);

    const sum = (pick: (l: BudgetLine) => number) => lines.reduce((s, l) => s + pick(l), 0);
    return {
      month,
      currency: ctx.main,
      unconverted: [...unconverted].sort(),
      monthProgress: progress,
      lines,
      unbudgeted,
      totals: {
        availableMinor: sum((l) => l.availableMinor),
        spentMinor: sum((l) => l.spentMinor),
        remainingMinor: sum((l) => l.remainingMinor),
      },
    };
  }

  /** Sets (or changes) a category's limit from `month` on; earlier months keep theirs. */
  async set(input: SetBudgetInput): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category || category.isSystem || category.kind !== "expense") {
      throw new BadRequestException("Budgets are for expense categories");
    }
    const month = fromIsoDate(`${input.month}-01`);
    // Limits are typed in the main currency; remember which it was.
    const currency = await this.currencies.mainCode();
    await this.prisma.budget.upsert({
      where: { categoryId_month: { categoryId: input.categoryId, month } },
      create: {
        categoryId: input.categoryId,
        month,
        amountMinor: input.amountMinor,
        rollover: input.rollover,
        currency,
      },
      update: { amountMinor: input.amountMinor, rollover: input.rollover, currency },
    });
    log.info(
      { categoryId: input.categoryId, month: input.month, amountMinor: input.amountMinor },
      "budget set",
    );
  }

  /**
   * Ends a category's budget from `month` on. If there was no budget before
   * `month` anyway, the row for `month` is simply removed rather than
   * recording an end to nothing.
   */
  async remove(categoryId: string, month: string): Promise<void> {
    const first = fromIsoDate(`${month}-01`);
    const earlier = await this.prisma.budget.findMany({
      where: { categoryId, month: { lt: first } },
      orderBy: { month: "asc" },
    });
    const before = ruleFor(
      earlier.map((r) => ({
        month: toIsoDate(r.month).slice(0, 7),
        amountMinor: r.amountMinor,
        rollover: r.rollover,
      })),
      shiftMonth(month, -1),
    );
    if (before) {
      await this.prisma.budget.upsert({
        where: { categoryId_month: { categoryId, month: first } },
        create: { categoryId, month: first, amountMinor: null },
        update: { amountMinor: null, rollover: false },
      });
    } else {
      await this.prisma.budget.deleteMany({ where: { categoryId, month: first } });
    }
    log.info({ categoryId, month }, "budget removed");
  }
}
