import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { categoryMetadata } from "#finance/categories.service";
import type { ImportTransactionsInput } from "#finance/dto/import.dto";
import { MonthlyTotalsService } from "#finance/monthly-totals.service";

const log = scopedLogger("ImportService");

/** How far apart (days) a bank row and a hand-logged transaction can be and still be "the same". */
const MATCH_WINDOW_DAYS = 3;
const DAY_MS = 86_400_000;

export type ImportRowStatus =
  /** Will be (or was) imported. */
  | "new"
  /** Already imported from an earlier file: skipped. */
  | "duplicate"
  /** Looks like a transaction logged by hand: skipped unless includeMatched. */
  | "matched"
  /** Dated before the account's opening balance: its effect is already in that balance. */
  | "beforeOpening";

export interface ImportRowResult {
  index: number;
  status: ImportRowStatus;
  /** The category it would get (payee history, then category aliases); null → "To review". */
  categoryId: string | null;
  /** For "matched": the hand-logged transaction it matched. */
  matchedTransactionId: string | null;
}

export interface ImportResult {
  rows: ImportRowResult[];
  imported: number;
  duplicates: number;
  matched: number;
  beforeOpening: number;
}

/** Case, accents and spacing don't matter when comparing payees: "TESCO  Stores" = "tesco stores". */
export function foldPayee(payee: string | null): string {
  return (
    (payee ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/g, "d")
      // "SAINSBURY'S" and "sainsburys" are the same shop.
      .replace(/['\u2019]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

/**
 * The dedupe key for an imported row. `occurrence` counts identical
 * (date, amount, payee) rows within one file, so two real £3.50 coffees on
 * one day both import, and re-importing the file skips both
 * (docs/finance/recurring-and-import.md).
 */
export function importHash(
  accountId: string,
  date: string,
  amountMinor: number,
  payee: string | null,
  occurrence: number,
): string {
  return createHash("sha256")
    .update(`${accountId}|${date}|${amountMinor}|${foldPayee(payee)}|${occurrence}`)
    .digest("hex");
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totals: MonthlyTotalsService,
  ) {}

  async importRows(input: ImportTransactionsInput): Promise<ImportResult> {
    const account = await this.prisma.account.findUnique({ where: { id: input.accountId } });
    if (!account) throw new NotFoundException(`Account ${input.accountId} not found`);
    if (account.archivedAt) throw new BadRequestException(`${account.name} is archived`);
    const opening = toIsoDate(account.openingBalanceDate);

    // Hash every row, numbering identical rows within the file.
    const seen = new Map<string, number>();
    const hashes = input.rows.map((row) => {
      const key = `${row.date}|${row.amountMinor}|${foldPayee(row.payee)}`;
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      return importHash(account.id, row.date, row.amountMinor, row.payee, occurrence);
    });

    const inFile = input.rows.filter((r) => r.date >= opening);
    const earliest = inFile.reduce((min, r) => (r.date < min ? r.date : min), "9999-12-31");
    const latest = inFile.reduce((max, r) => (r.date > max ? r.date : max), "0000-01-01");
    const [alreadyImported, manual, guess] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { accountId: account.id, importHash: { in: hashes } },
        select: { importHash: true },
      }),
      inFile.length === 0
        ? []
        : this.prisma.transaction.findMany({
            where: {
              accountId: account.id,
              importHash: null,
              transferId: null,
              source: { not: "adjustment" },
              date: {
                gte: new Date(fromIsoDate(earliest).getTime() - MATCH_WINDOW_DAYS * DAY_MS),
                lte: new Date(fromIsoDate(latest).getTime() + MATCH_WINDOW_DAYS * DAY_MS),
              },
            },
            select: { id: true, date: true, amountMinor: true },
          }),
      this.categoryGuesser(),
    ]);
    const imported = new Set(alreadyImported.map((t) => t.importHash));
    const unmatched = new Map(manual.map((t) => [t.id, t]));

    const results: ImportRowResult[] = input.rows.map((row, index) => {
      const base = {
        index,
        categoryId: guess(row.payee, row.amountMinor),
        matchedTransactionId: null,
      };
      if (row.date < opening) return { ...base, status: "beforeOpening" };
      if (imported.has(hashes[index])) return { ...base, status: "duplicate" };
      // The closest hand-logged transaction with the same amount, each used once.
      const day = fromIsoDate(row.date).getTime();
      let best: { id: string; gap: number } | null = null;
      for (const t of unmatched.values()) {
        const gap = Math.abs(t.date.getTime() - day) / DAY_MS;
        if (
          t.amountMinor === row.amountMinor &&
          gap <= MATCH_WINDOW_DAYS &&
          (!best || gap < best.gap)
        ) {
          best = { id: t.id, gap };
        }
      }
      if (best) {
        unmatched.delete(best.id);
        return { ...base, status: "matched", matchedTransactionId: best.id };
      }
      return { ...base, status: "new" };
    });

    const count = (status: ImportRowStatus) => results.filter((r) => r.status === status).length;
    const summary = {
      rows: results,
      duplicates: count("duplicate"),
      matched: count("matched"),
      beforeOpening: count("beforeOpening"),
    };
    if (input.dryRun) return { ...summary, imported: 0 };

    const toInsert = results.filter(
      (r) => r.status === "new" || (r.status === "matched" && input.includeMatched),
    );
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.transaction.createManyAndReturn({
        data: toInsert.map((r) => {
          const row = input.rows[r.index];
          return {
            accountId: account.id,
            date: fromIsoDate(row.date),
            amountMinor: row.amountMinor,
            payee: row.payee,
            note: row.note,
            categoryId: r.categoryId,
            importHash: hashes[r.index],
            source: "import",
          };
        }),
        // A concurrent import of the same file loses the race quietly.
        skipDuplicates: true,
      });
      await this.totals.apply(
        tx,
        rows.map((row) => ({ row, sign: 1 as const })),
      );
      return rows;
    });
    log.info(
      {
        accountId: account.id,
        imported: created.length,
        duplicates: summary.duplicates,
        matched: summary.matched,
      },
      "transactions imported",
    );
    return { ...summary, imported: created.length };
  }

  /**
   * Guesses a row's category: the category the same payee was last filed
   * under (quick log, form or an earlier import), else a category whose name
   * or alias appears in the payee ("TESCO STORES 3245" → Groceries). Money
   * in only matches income categories, money out only expense ones.
   */
  private async categoryGuesser(): Promise<
    (payee: string | null, amountMinor: number) => string | null
  > {
    const [history, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          payee: { not: null },
          categoryId: { not: null },
          transferId: null,
          source: { not: "adjustment" },
        },
        orderBy: { createdAt: "desc" },
        select: { payee: true, categoryId: true },
        take: 5000,
      }),
      this.prisma.category.findMany({ where: { archivedAt: null, isSystem: false } }),
    ]);
    const byPayee = new Map<string, string>();
    for (const t of history) {
      const key = foldPayee(t.payee);
      if (key && t.categoryId && !byPayee.has(key)) byPayee.set(key, t.categoryId);
    }
    const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
    const terms = categories
      .flatMap((c) =>
        [c.name, ...(categoryMetadata(c).aliases ?? [])].map((term) => ({
          term: foldPayee(term),
          id: c.id,
          kind: c.kind,
        })),
      )
      .filter((t) => t.term.length >= 3)
      .sort((a, b) => b.term.length - a.term.length);

    return (payee, amountMinor) => {
      const folded = foldPayee(payee);
      if (!folded) return null;
      const kind = amountMinor < 0 ? "expense" : "income";
      const remembered = byPayee.get(folded);
      if (remembered && kindOf.get(remembered) === kind) return remembered;
      const padded = ` ${folded} `;
      return terms.find((t) => t.kind === kind && padded.includes(` ${t.term} `))?.id ?? null;
    };
  }
}
