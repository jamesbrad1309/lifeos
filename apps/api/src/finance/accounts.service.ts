import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Account, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import {
  type AccountMetrics,
  SPENDABLE_TYPES,
  accountMetrics,
  lastStatementDate,
  storedBalance,
} from "#finance/account-metrics.util";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CategoriesService } from "#finance/categories.service";
import { CurrenciesService } from "#finance/currencies.service";
import { toMainMinor } from "#finance/currency-math.util";
import type {
  CreateAccountInput,
  ReconcileAccountInput,
  ReorderAccountsInput,
  UpdateAccountInput,
} from "#finance/dto/account.dto";
import { MonthlyTotalsService } from "#finance/monthly-totals.service";

const log = scopedLogger("AccountsService");

/** All in the main currency, converted at today's rates. */
export interface NetWorth {
  /** ISO code of the main currency the figures are in. */
  currency: string;
  netWorthMinor: number;
  /** Sum of positive balances. */
  assetsMinor: number;
  /** Sum of amounts owed, as a positive number. */
  liabilitiesMinor: number;
  /** Currencies left out because there's no rate for them yet. */
  unconverted: string[];
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly totals: MonthlyTotalsService,
    private readonly currencies: CurrenciesService,
  ) {}

  list(archived = false): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  findByIds(ids: string[]): Promise<Account[]> {
    return this.prisma.account.findMany({ where: { id: { in: ids } } });
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  /**
   * New accounts go to the end of the list. The first account money can be
   * spent from becomes the default, so quick log always has one to use.
   */
  async create(input: CreateAccountInput): Promise<Account> {
    const currency = input.currency ?? (await this.currencies.mainCode());
    await this.currencies.assertInUse(currency);
    const account = await this.prisma.$transaction(async (tx) => {
      const last = await tx.account.aggregate({ _max: { sortOrder: true } });
      const hasDefault = (await tx.account.count({ where: { isDefault: true } })) > 0;
      return tx.account.create({
        data: {
          ...toColumns(input),
          currency,
          openingBalanceMinor: storedBalance(
            input.type,
            input.currentBalanceMinor,
            input.type === "IOU" ? input.owedByMe : undefined,
          ),
          openingBalanceDate: fromIsoDate(input.openingBalanceDate ?? toIsoDate(new Date())),
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          isDefault: !hasDefault && SPENDABLE_TYPES.includes(input.type),
        },
      });
    });
    log.info({ accountId: account.id, type: account.type }, "account created");
    return account;
  }

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const existing = await this.findOne(id);
    if (existing.type !== input.type) {
      throw new BadRequestException(
        "An account's type can't change; archive it and add a new one instead",
      );
    }
    const account = await this.prisma.account.update({ where: { id }, data: toColumns(input) });
    log.info({ accountId: id }, "account updated");
    return account;
  }

  /**
   * Archived accounts drop out of lists and net worth but keep their
   * transactions. If it was the default, the next spendable account in the
   * user's order takes over.
   */
  async archive(id: string): Promise<Account> {
    const existing = await this.findOne(id);
    if (existing.archivedAt) return existing;

    const account = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.account.update({
        where: { id },
        data: { archivedAt: new Date(), isDefault: false },
      });
      if (existing.isDefault) {
        const next = await tx.account.findFirst({
          where: { archivedAt: null, type: { in: [...SPENDABLE_TYPES] } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        if (next) await tx.account.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      return archived;
    });
    log.info({ accountId: id }, "account archived");
    return account;
  }

  /** Brings an archived account back, at the end of the list. */
  async unarchive(id: string): Promise<Account> {
    const existing = await this.findOne(id);
    if (!existing.archivedAt) return existing;
    const last = await this.prisma.account.aggregate({
      where: { archivedAt: null },
      _max: { sortOrder: true },
    });
    const account = await this.prisma.account.update({
      where: { id },
      data: { archivedAt: null, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    log.info({ accountId: id }, "account unarchived");
    return account;
  }

  async setDefault(id: string): Promise<Account> {
    const existing = await this.findOne(id);
    if (existing.archivedAt || !SPENDABLE_TYPES.includes(existing.type)) {
      throw new BadRequestException(
        "Only an active bank account, card or cash account can be the default",
      );
    }
    // Clear first: the partial unique index allows only one default at a time.
    const account = await this.prisma.$transaction(async (tx) => {
      await tx.account.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.account.update({ where: { id }, data: { isDefault: true } });
    });
    log.info({ accountId: id }, "default account set");
    return account;
  }

  /** `ids` in their new order; accounts not listed keep their position values. */
  async reorder({ ids }: ReorderAccountsInput): Promise<Account[]> {
    const unique = [...new Set(ids)];
    const found = await this.prisma.account.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw new BadRequestException("Unknown account id in ids");

    await this.prisma.$transaction(
      unique.map((id, sortOrder) =>
        this.prisma.account.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    log.info({ count: unique.length }, "accounts reordered");
    return this.list();
  }

  /**
   * "Update balance": records one Adjustment transaction for the difference
   * between the real balance and ours, so the numbers are right without
   * every transaction having been logged.
   */
  async reconcile(id: string, input: ReconcileAccountInput): Promise<Account> {
    const existing = await this.findOne(id);
    if (input.date < toIsoDate(existing.openingBalanceDate)) {
      throw new BadRequestException("date can't be before the account's opening balance date");
    }

    const [metrics] = await this.metrics([id], new Date());
    const differenceMinor = input.actualBalanceMinor - metrics.balanceMinor;
    const adjustment = await this.categories.adjustmentCategory();

    const account = await this.prisma.$transaction(async (tx) => {
      if (differenceMinor !== 0) {
        const adjustmentRow = await tx.transaction.create({
          data: {
            accountId: id,
            categoryId: adjustment.id,
            date: fromIsoDate(input.date),
            amountMinor: differenceMinor,
            payee: "Balance adjustment",
            source: "adjustment",
          },
        });
        // Adjustments aren't counted in reports, but every transaction write
        // goes through the totals so that rule lives in one place.
        await this.totals.apply(tx, [{ row: adjustmentRow, sign: 1 }]);
      }
      return tx.account.update({ where: { id }, data: { lastReconciledAt: new Date() } });
    });
    log.info({ accountId: id, differenceMinor }, "account reconciled");
    return account;
  }

  /**
   * Balances and derived card/loan values for many accounts at once: one
   * call per BFF DataLoader batch, two aggregate queries however many
   * accounts. Summing every transaction equals "since openingBalanceDate"
   * because transactions dated earlier are rejected on write.
   */
  async metrics(ids: string[], today: Date): Promise<AccountMetrics[]> {
    const accounts = await this.prisma.account.findMany({ where: { id: { in: ids } } });

    const statementStarts = accounts.flatMap((account) =>
      account.type === "CREDIT_CARD" && account.statementDay
        ? [{ accountId: account.id, date: { gt: lastStatementDate(account.statementDay, today) } }]
        : [],
    );

    const [sums, statementSums] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ["accountId"],
        where: { accountId: { in: ids } },
        _sum: { amountMinor: true },
      }),
      statementStarts.length === 0
        ? []
        : this.prisma.transaction.groupBy({
            by: ["accountId"],
            where: {
              OR: statementStarts,
              amountMinor: { lt: 0 },
              // Card payments are transfers, and adjustments aren't spending.
              transferId: null,
              source: { not: "adjustment" },
            } satisfies Prisma.TransactionWhereInput,
            _sum: { amountMinor: true },
          }),
    ]);

    const sumById = new Map(sums.map((s) => [s.accountId, s._sum.amountMinor ?? 0]));
    const spendById = new Map(statementSums.map((s) => [s.accountId, -(s._sum.amountMinor ?? 0)]));
    const byId = new Map(accounts.map((account) => [account.id, account]));

    const ctx = await this.currencies.conversionContext();
    const onDate = toIsoDate(today);
    return ids.flatMap((id) => {
      const account = byId.get(id);
      if (!account) return [];
      const metrics = accountMetrics(account, sumById.get(id) ?? 0, spendById.get(id) ?? 0, today);
      metrics.balanceMainMinor = toMainMinor(ctx, metrics.balanceMinor, account.currency, onDate);
      return [metrics];
    });
  }

  async netWorth(): Promise<NetWorth> {
    const accounts = await this.list();
    const metrics = await this.metrics(
      accounts.map((a) => a.id),
      new Date(),
    );
    const currencyById = new Map(accounts.map((a) => [a.id, a.currency]));
    let assetsMinor = 0;
    let liabilitiesMinor = 0;
    const unconverted = new Set<string>();
    for (const { accountId, balanceMainMinor } of metrics) {
      if (balanceMainMinor === null) {
        unconverted.add(currencyById.get(accountId) ?? "?");
        continue;
      }
      if (balanceMainMinor >= 0) assetsMinor += balanceMainMinor;
      else liabilitiesMinor -= balanceMainMinor;
    }
    return {
      currency: await this.currencies.mainCode(),
      netWorthMinor: assetsMinor - liabilitiesMinor,
      assetsMinor,
      liabilitiesMinor,
      unconverted: [...unconverted].sort(),
    };
  }
}

/**
 * Maps validated input onto every detail column, nulling the ones that don't
 * belong to its type.
 */
function toColumns(input: UpdateAccountInput | CreateAccountInput) {
  const card = input.type === "CREDIT_CARD" ? input : null;
  const loan = input.type === "LOAN" ? input : null;
  const iou = input.type === "IOU" ? input : null;
  const date = (value: string | null | undefined) => (value ? fromIsoDate(value) : null);

  return {
    name: input.name,
    type: input.type,
    institution: input.institution ?? null,
    last4: input.last4 ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    creditLimitMinor: card?.creditLimitMinor ?? null,
    statementDay: card?.statementDay ?? null,
    paymentDueDay: card?.paymentDueDay ?? null,
    minPaymentMinor: card?.minPaymentMinor ?? null,
    aprBps: card?.aprBps ?? loan?.aprBps ?? null,
    monthlyPaymentMinor: loan?.monthlyPaymentMinor ?? null,
    loanStartDate: date(loan?.loanStartDate),
    termMonths: loan?.termMonths ?? null,
    dueDate: date(iou?.dueDate),
  };
}
