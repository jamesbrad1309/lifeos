import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { Transaction } from "@prisma/client";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { toIsoDate } from "#finance/calendar.util";
import {
  type CreateTransactionInput,
  type CreateTransferInput,
  type ListTransactionsInput,
  type UpdateTransactionInput,
  createTransactionSchema,
  createTransferSchema,
  listTransactionsSchema,
  updateTransactionSchema,
} from "#finance/dto/transaction.dto";
import { TransactionsService } from "#finance/transactions.service";

/** `date` is a `@db.Date` column: "YYYY-MM-DD" on the wire, like habit entries. */
export function toTransactionDto(t: Transaction) {
  return { ...t, date: toIsoDate(t.date) };
}

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /**
   * `GET /transactions?accountId&categoryId&from&to&search&uncategorised&first&after`:
   * newest first, cursor-paginated.
   */
  @Get()
  async list(@Query(new ZodValidationPipe(listTransactionsSchema)) input: ListTransactionsInput) {
    const page = await this.transactions.list(input);
    return { items: page.items.map(toTransactionDto), nextCursor: page.nextCursor };
  }

  @Get("to-review-count")
  async toReviewCount() {
    return { count: await this.transactions.toReviewCount() };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return toTransactionDto(await this.transactions.findOne(id));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTransactionSchema)) input: CreateTransactionInput,
  ) {
    return toTransactionDto(await this.transactions.create(input));
  }

  /** `POST /transactions/transfers`: both legs; returns [out, in]. */
  @Post("transfers")
  async transfer(@Body(new ZodValidationPipe(createTransferSchema)) input: CreateTransferInput) {
    return (await this.transactions.createTransfer(input)).map(toTransactionDto);
  }

  /** Partial: only the fields sent change. Categorising from the inbox sends just `categoryId`. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) input: UpdateTransactionInput,
  ) {
    return toTransactionDto(await this.transactions.update(id, input));
  }

  /** Returns every id deleted: both legs, for a transfer. */
  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ ids: string[] }> {
    return this.transactions.remove(id);
  }
}
