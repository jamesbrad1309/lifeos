import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import type { Currency } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { toIsoDate } from "#finance/calendar.util";
import { type ConversionContext, type RateTable, rateToMain } from "#finance/currency-math.util";
import { ExchangeRatesService } from "#finance/exchange-rates.service";

const log = scopedLogger("CurrenciesService");

/** The currency a fresh install starts with (the app's original single currency). */
const DEFAULT_MAIN = "GBP";

export interface CurrencyView {
  code: string;
  isMain: boolean;
  sortOrder: number;
  /** The user's own rate (main units per 1 unit), if set. */
  overrideToMain: number | null;
  /** The latest fetched rate to the main currency, whether or not overridden. */
  marketRateToMain: number | null;
  /** What conversions use today: the override, else the market rate. Null: no rate yet. */
  rateToMain: number | null;
  /** How many accounts (archived included) use it: it can't be removed while any do. */
  accountCount: number;
}

export interface CurrenciesOverview {
  currencies: CurrencyView[];
  /** The newest stored rates, and who to credit for them. */
  rates: {
    date: string;
    source: string;
    fetchedAt: Date;
    attribution: { label: string; url: string };
  } | null;
}

/** Real ISO 4217 codes only: Intl.NumberFormat alone accepts any three letters ("XYZ"). */
const ISO_CODES = new Set(Intl.supportedValuesOf("currency"));

function isIsoCode(code: string): boolean {
  return ISO_CODES.has(code);
}

/**
 * The currencies the user works in and which one is main. Also builds the
 * ConversionContext every report converts with, so reports never need to
 * know where rates come from.
 */
@Injectable()
export class CurrenciesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: ExchangeRatesService,
  ) {}

  /** A fresh database gets a main currency; one left without (it shouldn't be) gets one back. */
  async onModuleInit(): Promise<void> {
    const main = await this.prisma.currency.findFirst({ where: { isMain: true } });
    if (main) return;
    const first = await this.prisma.currency.findFirst({ orderBy: { sortOrder: "asc" } });
    if (first) {
      await this.prisma.currency.update({ where: { code: first.code }, data: { isMain: true } });
    } else {
      await this.prisma.currency.create({ data: { code: DEFAULT_MAIN, isMain: true } });
    }
    log.info({ code: first?.code ?? DEFAULT_MAIN }, "main currency set");
  }

  async mainCode(): Promise<string> {
    const main = await this.prisma.currency.findFirst({ where: { isMain: true } });
    return main?.code ?? DEFAULT_MAIN;
  }

  async assertInUse(code: string): Promise<void> {
    const found = await this.prisma.currency.findUnique({ where: { code } });
    if (!found) throw new BadRequestException(`${code} isn't one of your currencies; add it first`);
  }

  /**
   * Everything conversions need: the main currency, overrides, and the rate
   * history of the currencies in use (a few hundred rows a year each).
   */
  async conversionContext(): Promise<ConversionContext> {
    const currencies = await this.prisma.currency.findMany();
    const codes = currencies.map((c) => c.code);
    const rows = await this.prisma.exchangeRate.findMany({
      where: { code: { in: codes } },
      orderBy: { date: "asc" },
      select: { code: true, date: true, perUsd: true },
    });
    const table: RateTable = new Map();
    for (const row of rows) {
      const days = table.get(row.code) ?? [];
      days.push({ date: toIsoDate(row.date), perUsd: row.perUsd });
      table.set(row.code, days);
    }
    return {
      table,
      main: currencies.find((c) => c.isMain)?.code ?? DEFAULT_MAIN,
      overrides: new Map(
        currencies.flatMap((c) => (c.overrideToMain ? [[c.code, c.overrideToMain] as const] : [])),
      ),
    };
  }

  async overview(): Promise<CurrenciesOverview> {
    const [currencies, ctx, counts, rates] = await Promise.all([
      this.prisma.currency.findMany({
        orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }, { code: "asc" }],
      }),
      this.conversionContext(),
      this.prisma.account.groupBy({ by: ["currency"], _count: { _all: true } }),
      this.rates.latest(),
    ]);
    const today = toIsoDate(new Date());
    const used = new Map(counts.map((c) => [c.currency, c._count._all]));
    const market = { ...ctx, overrides: new Map<string, number>() };
    return {
      currencies: currencies.map((c: Currency) => ({
        code: c.code,
        isMain: c.isMain,
        sortOrder: c.sortOrder,
        overrideToMain: c.overrideToMain,
        marketRateToMain: rateToMain(market, c.code, today),
        rateToMain: rateToMain(ctx, c.code, today),
        accountCount: used.get(c.code) ?? 0,
      })),
      rates,
    };
  }

  async add(code: string): Promise<void> {
    if (!isIsoCode(code)) throw new BadRequestException(`${code} isn't an ISO 4217 currency code`);
    const last = await this.prisma.currency.aggregate({ _max: { sortOrder: true } });
    await this.prisma.currency.upsert({
      where: { code },
      create: { code, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      update: {},
    });
    log.info({ code }, "currency added");
  }

  async remove(code: string): Promise<void> {
    const currency = await this.prisma.currency.findUnique({ where: { code } });
    if (!currency) throw new NotFoundException(`${code} isn't one of your currencies`);
    if (currency.isMain)
      throw new BadRequestException(
        "The main currency can't be removed; choose another main first",
      );
    const inUse = await this.prisma.account.count({ where: { currency: code } });
    if (inUse > 0) throw new BadRequestException(`${inUse} account(s) use ${code}`);
    await this.prisma.currency.delete({ where: { code } });
    log.info({ code }, "currency removed");
  }

  /**
   * Makes `code` the main currency. Overrides are relative to the old main,
   * so they're cleared rather than silently reinterpreted.
   */
  async setMain(code: string): Promise<void> {
    await this.assertInUse(code);
    await this.prisma.$transaction(async (tx) => {
      await tx.currency.updateMany({ where: { isMain: true }, data: { isMain: false } });
      await tx.currency.updateMany({ data: { overrideToMain: null } });
      await tx.currency.update({ where: { code }, data: { isMain: true } });
    });
    log.info({ code }, "main currency changed");
  }

  async setOverride(code: string, rateToMain: number | null): Promise<void> {
    const currency = await this.prisma.currency.findUnique({ where: { code } });
    if (!currency) throw new NotFoundException(`${code} isn't one of your currencies`);
    if (currency.isMain) throw new BadRequestException("The main currency's rate is always 1");
    await this.prisma.currency.update({ where: { code }, data: { overrideToMain: rateToMain } });
    log.info({ code, overridden: rateToMain !== null }, "exchange rate override set");
  }
}
