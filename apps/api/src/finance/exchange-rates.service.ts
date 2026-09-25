import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";

const log = scopedLogger("ExchangeRatesService");

/** How often to check whether today's rates are in. Providers publish once a day. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface FetchedRates {
  /** YYYY-MM-DD the provider says the rates are for. */
  date: string;
  /** Units per 1 USD, keyed by upper-case ISO code. */
  perUsd: Record<string, number>;
  source: string;
}

interface RateProvider {
  name: string;
  /** Shown on the currencies screen: some providers require attribution. */
  attribution: { label: string; url: string };
  fetch(): Promise<FetchedRates>;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/**
 * Free, keyless daily rates covering ~160 currencies including VND.
 * Terms: https://www.exchangerate-api.com/terms (attribution required).
 */
const openErApi: RateProvider = {
  name: "open.er-api.com",
  attribution: { label: "Rates by Exchange Rate API", url: "https://www.exchangerate-api.com" },
  async fetch() {
    const body = (await getJson("https://open.er-api.com/v6/latest/USD")) as {
      result: string;
      time_last_update_unix: number;
      rates: Record<string, number>;
    };
    if (body.result !== "success") throw new Error(`open.er-api.com result: ${body.result}`);
    return {
      date: toIsoDate(new Date(body.time_last_update_unix * 1000)),
      perUsd: body.rates,
      source: this.name,
    };
  },
};

/** Fallback: fawazahmed0/exchange-api, CC0, served from jsDelivr; 300+ currencies. */
const currencyApi: RateProvider = {
  name: "fawazahmed0/currency-api",
  attribution: {
    label: "Rates by fawazahmed0/exchange-api",
    url: "https://github.com/fawazahmed0/exchange-api",
  },
  async fetch() {
    const body = (await getJson(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    )) as { date: string; usd: Record<string, number> };
    const perUsd = Object.fromEntries(
      Object.entries(body.usd)
        .filter(([code]) => /^[a-z]{3}$/.test(code))
        .map(([code, rate]) => [code.toUpperCase(), rate]),
    );
    return { date: body.date, perUsd, source: this.name };
  },
};

const PROVIDERS = [openErApi, currencyApi];

export interface RefreshResult {
  date: string;
  source: string;
  currencies: number;
}

/**
 * Keeps a daily history of exchange rates in `exchange_rates`. Fetches on
 * start and every few hours if the newest stored day is older than today,
 * trying each provider in turn. Offline is fine: conversions use the latest
 * stored rates, and totals report any currency they couldn't convert.
 */
@Injectable()
export class ExchangeRatesService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Don't hold up startup on the network.
    void this.refreshIfStale();
    this.timer = setInterval(() => void this.refreshIfStale(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Who the stored rates came from, for the screen's attribution line. */
  async latest(): Promise<{
    date: string;
    source: string;
    fetchedAt: Date;
    attribution: RateProvider["attribution"];
  } | null> {
    const row = await this.prisma.exchangeRate.findFirst({
      orderBy: [{ date: "desc" }, { fetchedAt: "desc" }],
    });
    if (!row) return null;
    const provider = PROVIDERS.find((p) => p.name === row.source) ?? PROVIDERS[0];
    return {
      date: toIsoDate(row.date),
      source: row.source,
      fetchedAt: row.fetchedAt,
      attribution: provider.attribution,
    };
  }

  async refreshIfStale(): Promise<void> {
    const latest = await this.latest().catch(() => null);
    if (latest && latest.date >= toIsoDate(new Date(Date.now() - 86_400_000))) return;
    try {
      await this.refresh();
    } catch (err) {
      log.warn({ err: (err as Error).message }, "exchange rates not refreshed; using stored rates");
    }
  }

  /** Fetches today's rates from the first provider that answers and stores them. */
  async refresh(): Promise<RefreshResult> {
    const errors: string[] = [];
    for (const provider of PROVIDERS) {
      try {
        const fetched = await provider.fetch();
        const rows = Object.entries(fetched.perUsd).filter(
          ([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0,
        );
        const date = fromIsoDate(fetched.date);
        await this.prisma.$transaction([
          this.prisma.exchangeRate.deleteMany({ where: { date } }),
          this.prisma.exchangeRate.createMany({
            data: rows.map(([code, perUsd]) => ({ date, code, perUsd, source: fetched.source })),
          }),
        ]);
        log.info(
          { date: fetched.date, source: fetched.source, currencies: rows.length },
          "exchange rates stored",
        );
        return { date: fetched.date, source: fetched.source, currencies: rows.length };
      } catch (err) {
        errors.push(`${provider.name}: ${(err as Error).message}`);
      }
    }
    throw new Error(`No rate provider answered (${errors.join("; ")})`);
  }
}
