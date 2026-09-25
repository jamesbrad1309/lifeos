import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type Category, Prisma, type QuickPreset, type Transaction } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import {
  CategoriesService,
  STARTER_CATEGORY_NAMES,
  categoryMetadata,
} from "#finance/categories.service";
import type {
  CreateQuickPresetInput,
  QuickLogContextInput,
  QuickLogInput,
} from "#finance/dto/quick-log.dto";
import { TransactionsService } from "#finance/transactions.service";

const log = scopedLogger("QuickLogService");

const SUGGESTED_COUNT = 6;
const RANKING_WINDOW_DAYS = 90;
const PRESET_WINDOW_DAYS = 30;
const PRESET_THRESHOLD = 3;
const DAY_MS = 86_400_000;

export interface QuickLogContext {
  defaultAccountId: string | null;
  suggestedCategories: Category[];
  presets: QuickPreset[];
  /** Recent payees with the category they were last logged under, for the one-line parser. */
  recentPayees: { payee: string; categoryId: string | null }[];
  toReviewCount: number;
  lastAccountByCategory: Record<string, string>;
}

export interface QuickLogResult {
  transaction: Transaction;
  /** This has been logged often enough to offer "Save as preset?". */
  suggestPreset: boolean;
  /** Identifies the combination, to dismiss the suggestion for good. */
  presetKey: string | null;
}

interface RankableLog {
  categoryId: string;
  createdAt: Date;
}

/** Newest first in, newest kept: "Flat white" and "flat white" are one payee. */
function uniquePayees(rows: { payee: string | null; categoryId: string | null }[]) {
  const seen = new Set<string>();
  return rows.flatMap(({ payee, categoryId }) => {
    const key = payee?.trim().toLowerCase();
    if (!payee || !key || seen.has(key)) return [];
    seen.add(key);
    return [{ payee, categoryId }];
  });
}

const isWeekend = (dayOfWeek: number) => dayOfWeek === 0 || dayOfWeek === 6;

/**
 * Scores each category by how often and how recently it was quick-logged,
 * weighted towards this time of day and this kind of day
 * (docs/finance/quick-log-implementation.md, "Ranking suggested categories"):
 * recency 0.5^(daysAgo/14) × 2 within an hour of now × 1.5 on the same
 * weekday/weekend type.
 */
export function rankCategories(
  logs: RankableLog[],
  now: Date,
  context: Pick<QuickLogContextInput, "hour" | "dayOfWeek" | "utcOffsetMinutes">,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const entry of logs) {
    // createdAt is UTC; shift it to the user's local clock before reading hour/day.
    const local = new Date(entry.createdAt.getTime() - context.utcOffsetMinutes * 60_000);
    const hourGap = Math.abs(local.getUTCHours() - context.hour);
    const sameTime = Math.min(hourGap, 24 - hourGap) <= 1;
    const sameDayType = isWeekend(local.getUTCDay()) === isWeekend(context.dayOfWeek);
    const daysAgo = Math.max(0, (now.getTime() - entry.createdAt.getTime()) / DAY_MS);

    const score = 0.5 ** (daysAgo / 14) * (sameTime ? 2 : 1) * (sameDayType ? 1.5 : 1);
    scores.set(entry.categoryId, (scores.get(entry.categoryId) ?? 0) + score);
  }
  return scores;
}

@Injectable()
export class QuickLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
  ) {}

  /** Everything the log sheet needs to open instantly, in one call. */
  async context(input: QuickLogContextInput): Promise<QuickLogContext> {
    const now = new Date();
    const since = new Date(now.getTime() - RANKING_WINDOW_DAYS * DAY_MS);

    const [defaultAccount, categories, presets, logs, payees, toReviewCount, lastByCategory] =
      await Promise.all([
        this.prisma.account.findFirst({ where: { isDefault: true, archivedAt: null } }),
        this.categories.list(),
        this.listPresets(),
        this.prisma.transaction.findMany({
          where: { source: "quick", categoryId: { not: null }, createdAt: { gte: since } },
          select: { categoryId: true, createdAt: true },
        }),
        this.prisma.transaction.findMany({
          where: { payee: { not: null }, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          distinct: ["payee"],
          select: { payee: true, categoryId: true },
          take: 100,
        }),
        this.transactions.toReviewCount(),
        this.prisma.transaction.findMany({
          where: { source: "quick", categoryId: { not: null } },
          orderBy: { createdAt: "desc" },
          distinct: ["categoryId"],
          select: { categoryId: true, accountId: true },
        }),
      ]);

    const expenseCategories = categories.filter((c) => c.kind === "expense");
    const scores = rankCategories(logs as RankableLog[], now, input);
    const starterRank = (c: Category) => {
      const i = STARTER_CATEGORY_NAMES.indexOf(c.name);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    // Ranked by score; categories never logged fall back to the starter list,
    // so a new user (or a quiet week) still gets six sensible chips.
    const suggestedCategories = [...expenseCategories]
      .sort(
        (a, b) =>
          (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
          starterRank(a) - starterRank(b) ||
          a.sortOrder - b.sortOrder,
      )
      .slice(0, SUGGESTED_COUNT);

    return {
      defaultAccountId: defaultAccount?.id ?? null,
      suggestedCategories,
      presets,
      recentPayees: uniquePayees(payees),
      toReviewCount,
      lastAccountByCategory: Object.fromEntries(
        lastByCategory.flatMap((t) => (t.categoryId ? [[t.categoryId, t.accountId]] : [])),
      ),
    };
  }

  /**
   * Saves one expense (or income). Idempotent on `clientId`: a double tap or
   * a retried request returns the first save instead of logging it twice.
   */
  async quickLog(input: QuickLogInput): Promise<QuickLogResult> {
    const existing = await this.prisma.transaction.findUnique({
      where: { clientId: input.clientId },
    });
    if (existing) return { transaction: existing, suggestPreset: false, presetKey: null };

    const accountId = input.accountId ?? (await this.defaultAccountId());
    const date = input.date ?? toIsoDate(new Date());
    const amountMinor = input.isIncome ? input.amountMinor : -input.amountMinor;

    let transaction: Transaction;
    try {
      transaction = await this.transactions.create(
        {
          accountId,
          categoryId: input.categoryId ?? null,
          date,
          amountMinor,
          payee: input.payee ?? null,
          note: input.note ?? null,
        },
        "quick",
        input.clientId,
      );
    } catch (err) {
      // Two identical requests raced past the lookup above; the unique
      // clientId let one through. Return that one.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.prisma.transaction.findUniqueOrThrow({
          where: { clientId: input.clientId },
        });
        return { transaction: winner, suggestPreset: false, presetKey: null };
      }
      throw err;
    }

    log.debug(
      { transactionId: transaction.id, presetId: input.presetId, durationMs: input.durationMs },
      "quick log timing",
    );
    const presetKey = input.categoryId ? this.presetKey(transaction) : null;
    const suggestPreset =
      !input.presetId &&
      presetKey !== null &&
      (await this.shouldSuggestPreset(transaction, presetKey));
    return { transaction, suggestPreset, presetKey: suggestPreset ? presetKey : null };
  }

  listPresets(): Promise<QuickPreset[]> {
    return this.prisma.quickPreset.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async createPreset(input: CreateQuickPresetInput): Promise<QuickPreset> {
    const category = await this.categories.findOne(input.categoryId);
    if (category.isSystem) throw new BadRequestException("Presets can't use a system category");
    if (input.accountId) {
      const account = await this.prisma.account.findUnique({ where: { id: input.accountId } });
      if (!account) throw new BadRequestException(`Account ${input.accountId} not found`);
    }
    const last = await this.prisma.quickPreset.aggregate({ _max: { sortOrder: true } });
    const preset = await this.prisma.quickPreset.create({
      data: {
        label: input.label,
        emoji: input.emoji ?? category.icon,
        amountMinor: input.amountMinor ?? null,
        categoryId: input.categoryId,
        accountId: input.accountId ?? null,
        payee: input.payee ?? null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    log.info({ presetId: preset.id, categoryId: preset.categoryId }, "quick preset created");
    return preset;
  }

  async deletePreset(id: string): Promise<{ id: string }> {
    const preset = await this.prisma.quickPreset.findUnique({ where: { id } });
    if (!preset) throw new NotFoundException(`Preset ${id} not found`);
    await this.prisma.quickPreset.delete({ where: { id } });
    log.info({ presetId: id }, "quick preset deleted");
    return { id };
  }

  private async defaultAccountId(): Promise<string> {
    const account = await this.prisma.account.findFirst({
      where: { isDefault: true, archivedAt: null },
    });
    if (!account) throw new BadRequestException("Add an account in Money setup first");
    return account.id;
  }

  /** "340|flat white": the amount plus what it was called, if anything. */
  private presetKey(t: Transaction): string {
    return `${Math.abs(t.amountMinor)}|${(t.payee ?? t.note ?? "").trim().toLowerCase()}`;
  }

  /**
   * Offer "Save as preset?" once the same category, amount and payee/note
   * has been quick-logged 3 times in 30 days, unless a preset already
   * covers it or the user said no before.
   */
  private async shouldSuggestPreset(t: Transaction, key: string): Promise<boolean> {
    if (!t.categoryId) return false;
    const label = t.payee ?? t.note;
    const since = new Date(fromIsoDate(toIsoDate(t.date)).getTime() - PRESET_WINDOW_DAYS * DAY_MS);

    const [count, preset, category] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          source: "quick",
          categoryId: t.categoryId,
          amountMinor: t.amountMinor,
          date: { gte: since },
          ...(label
            ? {
                OR: [
                  { payee: { equals: label, mode: "insensitive" } },
                  { note: { equals: label, mode: "insensitive" } },
                ],
              }
            : { payee: null, note: null }),
        },
      }),
      this.prisma.quickPreset.findFirst({
        where: { categoryId: t.categoryId, amountMinor: Math.abs(t.amountMinor) },
      }),
      this.categories.findOne(t.categoryId),
    ]);

    const dismissed = categoryMetadata(category).dismissedPresetSuggestions ?? [];
    return count >= PRESET_THRESHOLD && !preset && !dismissed.includes(key);
  }
}
