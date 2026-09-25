import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type Account, Prisma, type Transaction } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import type {
  CreateTransactionInput,
  CreateTransferInput,
  ListTransactionsInput,
  UpdateTransactionInput,
} from "#finance/dto/transaction.dto";
import { MonthlyTotalsService } from "#finance/monthly-totals.service";

const log = scopedLogger("TransactionsService");

export interface TransactionPage {
  items: Transaction[];
  /** Opaque; pass back as `after`. Null when there are no more rows. */
  nextCursor: string | null;
}

/** Newest day first; within a day, the last logged first. `id` breaks exact ties. */
const ORDER: Prisma.TransactionOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

interface Cursor {
  date: string;
  createdAt: string;
  id: string;
}

function encodeCursor(t: Transaction): string {
  const cursor: Cursor = {
    date: toIsoDate(t.date),
    createdAt: t.createdAt.toISOString(),
    id: t.id,
  };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString()) as Cursor;
    if (typeof cursor.date === "string" && typeof cursor.createdAt === "string" && cursor.id) {
      return cursor;
    }
  } catch {
    // fall through
  }
  throw new BadRequestException("Invalid cursor");
}

/** Rows strictly after the cursor in ORDER, so a page never repeats or skips a row. */
function afterCursor({ date, createdAt, id }: Cursor): Prisma.TransactionWhereInput {
  const day = fromIsoDate(date);
  const at = new Date(createdAt);
  return {
    OR: [
      { date: { lt: day } },
      { date: day, createdAt: { lt: at } },
      { date: day, createdAt: at, id: { lt: id } },
    ],
  };
}

/** `SELECT … FOR UPDATE`: the rows, locked until the surrounding transaction ends. */
function lockTransactions(tx: Prisma.TransactionClient, where: Prisma.Sql) {
  return tx.$queryRaw<Transaction[]>`SELECT * FROM "transactions" WHERE ${where} FOR UPDATE`;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totals: MonthlyTotalsService,
  ) {}

  async list(input: ListTransactionsInput): Promise<TransactionPage> {
    const where: Prisma.TransactionWhereInput[] = [];
    if (input.accountId) where.push({ accountId: input.accountId });
    if (input.categoryId) where.push({ categoryId: input.categoryId });
    if (input.from) where.push({ date: { gte: fromIsoDate(input.from) } });
    if (input.to) where.push({ date: { lte: fromIsoDate(input.to) } });
    if (input.uncategorised) where.push({ categoryId: null, transferId: null });
    if (!input.includeTransfers) where.push({ transferId: null });
    if (input.search) {
      where.push({
        OR: [
          { payee: { contains: input.search, mode: "insensitive" } },
          { note: { contains: input.search, mode: "insensitive" } },
        ],
      });
    }
    if (input.after) where.push(afterCursor(decodeCursor(input.after)));

    // One extra row tells us whether there's another page.
    const rows = await this.prisma.transaction.findMany({
      where: { AND: where },
      orderBy: ORDER,
      take: input.first + 1,
    });
    const items = rows.slice(0, input.first);
    const hasMore = rows.length > input.first;
    return { items, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null };
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }

  /** Uncategorised, non-transfer transactions: the "To review" inbox. */
  toReviewCount(): Promise<number> {
    return this.prisma.transaction.count({ where: { categoryId: null, transferId: null } });
  }

  /** `clientId` makes quick log's saves idempotent (see QuickLogService.quickLog). */
  async create(
    input: CreateTransactionInput,
    source = "form",
    clientId?: string,
  ): Promise<Transaction> {
    await this.assertWritable(input.accountId, input.date);
    await this.assertCategory(input.categoryId);
    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          date: fromIsoDate(input.date),
          amountMinor: input.amountMinor,
          payee: input.payee ?? null,
          note: input.note ?? null,
          tags: input.tags ?? [],
          source,
          clientId,
        },
      });
      await this.totals.apply(tx, [{ row: created, sign: 1 }]);
      return created;
    });
    log.info(
      { transactionId: transaction.id, accountId: input.accountId, amountMinor: input.amountMinor },
      "transaction created",
    );
    return transaction;
  }

  async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const existing = await this.findOne(id);
    const moves = input.accountId !== undefined || input.date !== undefined;
    if (existing.transferId && (moves || input.amountMinor !== undefined)) {
      throw new BadRequestException(
        "A transfer's account, date and amount can't be edited; delete it and make a new one",
      );
    }
    if (existing.source === "adjustment" && input.categoryId !== undefined) {
      throw new BadRequestException("A balance adjustment keeps its Adjustment category");
    }
    if (moves) {
      await this.assertWritable(
        input.accountId ?? existing.accountId,
        input.date ?? toIsoDate(existing.date),
      );
    }
    if (input.categoryId !== undefined) await this.assertCategory(input.categoryId);

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Re-read under a row lock: a concurrent edit of the same transaction
      // waits here, so "before" is never subtracted from the totals twice.
      const [before] = await lockTransactions(tx, Prisma.sql`"id" = ${id}`);
      if (!before) throw new NotFoundException(`Transaction ${id} not found`);
      const after = await tx.transaction.update({
        where: { id },
        data: {
          accountId: input.accountId,
          categoryId: input.categoryId,
          date: input.date ? fromIsoDate(input.date) : undefined,
          amountMinor: input.amountMinor,
          payee: input.payee,
          note: input.note,
          tags: input.tags,
        },
      });
      await this.totals.apply(tx, [
        { row: before, sign: -1 },
        { row: after, sign: 1 },
      ]);
      return after;
    });
    log.info({ transactionId: id, fields: Object.keys(input) }, "transaction updated");
    return transaction;
  }

  /**
   * Both legs of a transfer, created together: out of `from`, into `to`,
   * sharing a `transferId`. Neither counts as spending or income (see
   * MonthlyTotalsService.isCounted). Each leg's metadata names the other
   * account, so a list can say "→ Amex" without a second lookup.
   */
  async createTransfer(input: CreateTransferInput): Promise<Transaction[]> {
    if (input.clientId) {
      const existing = await this.prisma.transaction.findUnique({
        where: { clientId: input.clientId },
      });
      if (existing?.transferId) {
        return this.prisma.transaction.findMany({
          where: { transferId: existing.transferId },
          orderBy: { amountMinor: "asc" },
        });
      }
    }

    const [from, to] = await Promise.all([
      this.assertWritable(input.fromAccountId, input.date),
      this.assertWritable(input.toAccountId, input.date),
    ]);
    const sameCurrency = from.currency === to.currency;
    if (!sameCurrency && input.toAmountMinor === undefined) {
      throw new BadRequestException(
        `${from.currency} → ${to.currency}: say how much arrived in ${to.currency} (toAmountMinor)`,
      );
    }
    if (
      sameCurrency &&
      input.toAmountMinor !== undefined &&
      input.toAmountMinor !== input.amountMinor
    ) {
      throw new BadRequestException(
        "Both accounts are in the same currency, so the amounts must match",
      );
    }

    const transferId = randomUUID();
    const date = fromIsoDate(input.date);
    const legs = await this.prisma.$transaction(async (tx) => {
      const out = await tx.transaction.create({
        data: {
          accountId: from.id,
          date,
          amountMinor: -input.amountMinor,
          payee: to.name,
          note: input.note ?? null,
          transferId,
          clientId: input.clientId,
          source: "transfer",
          metadata: { transferAccountId: to.id },
        },
      });
      const into = await tx.transaction.create({
        data: {
          accountId: to.id,
          date,
          amountMinor: input.toAmountMinor ?? input.amountMinor,
          payee: from.name,
          note: input.note ?? null,
          transferId,
          clientId: input.clientId ? `${input.clientId}:in` : undefined,
          source: "transfer",
          metadata: { transferAccountId: from.id },
        },
      });
      // No-ops (transfers aren't counted), but every write goes through the totals.
      await this.totals.apply(tx, [
        { row: out, sign: 1 },
        { row: into, sign: 1 },
      ]);
      return [out, into];
    });
    log.info(
      { transferId, fromAccountId: from.id, toAccountId: to.id, amountMinor: input.amountMinor },
      "transfer created",
    );
    return legs;
  }

  /** Deleting one leg of a transfer deletes both, so money never half-moves. */
  async remove(id: string): Promise<{ ids: string[] }> {
    const existing = await this.findOne(id);
    const where = existing.transferId
      ? Prisma.sql`"transferId" = ${existing.transferId}`
      : Prisma.sql`"id" = ${id}`;
    const doomed = await this.prisma.$transaction(async (tx) => {
      // Locked, then deleted: a second delete of the same row waits, then
      // finds nothing, so it's only taken out of the totals once.
      const rows = await lockTransactions(tx, where);
      await tx.transaction.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      await this.totals.apply(
        tx,
        rows.map((row) => ({ row, sign: -1 as const })),
      );
      return rows;
    });
    log.info({ transactionId: id, count: doomed.length }, "transaction deleted");
    return { ids: doomed.map((t) => t.id) };
  }

  /**
   * Balances sum every transaction from the opening balance on, so nothing
   * may be dated before an account's opening date (docs/finance/backend-module.md).
   */
  async assertWritable(accountId: string, date: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new BadRequestException(`Account ${accountId} not found`);
    if (account.archivedAt) throw new BadRequestException(`${account.name} is archived`);
    const opening = toIsoDate(account.openingBalanceDate);
    if (date < opening) {
      throw new BadRequestException(
        `${account.name} is tracked from ${opening}; use an earlier opening balance for older transactions`,
      );
    }
    return account;
  }

  private async assertCategory(categoryId: string | null | undefined): Promise<void> {
    if (!categoryId) return;
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.archivedAt || category.isSystem) {
      throw new BadRequestException("categoryId must be an active, non-system category");
    }
  }
}
