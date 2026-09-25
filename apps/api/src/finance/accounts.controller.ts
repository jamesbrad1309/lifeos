import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type { Account } from "@prisma/client";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import type { AccountMetrics } from "#finance/account-metrics.util";
import { AccountsService, type NetWorth } from "#finance/accounts.service";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import {
  type CreateAccountInput,
  type ReconcileAccountInput,
  type ReorderAccountsInput,
  type UpdateAccountInput,
  createAccountSchema,
  reconcileAccountSchema,
  reorderAccountsSchema,
  updateAccountSchema,
} from "#finance/dto/account.dto";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `@db.Date` columns go over the wire as plain "YYYY-MM-DD", like habit entries. */
function toAccountDto(account: Account) {
  const date = (value: Date | null) => (value ? toIsoDate(value) : null);
  return {
    ...account,
    openingBalanceDate: toIsoDate(account.openingBalanceDate),
    loanStartDate: date(account.loanStartDate),
    dueDate: date(account.dueDate),
  };
}

/**
 * Routes without an id (`balances`, `net-worth`, `reorder`) are declared
 * before `:id` so Nest doesn't match them as ids.
 */
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /**
   * `GET /accounts` in the user's order; `?archived=true` for archived ones;
   * `?ids=a,b` looks up by id, archived included (the BFF's DataLoader).
   */
  @Get()
  async list(@Query("archived") archived?: string, @Query("ids") ids?: string) {
    const accounts =
      ids !== undefined
        ? await this.accounts.findByIds(ids.split(",").filter(Boolean))
        : await this.accounts.list(archived === "true");
    return accounts.map(toAccountDto);
  }

  /**
   * Batch endpoint for the BFF's DataLoader: `GET /accounts/balances?ids=a,b&today=2026-09-25`.
   * `today` is the caller's calendar day, for due dates and statement periods.
   */
  @Get("balances")
  balances(@Query("ids") ids?: string, @Query("today") today?: string): Promise<AccountMetrics[]> {
    if (today !== undefined && !ISO_DATE.test(today)) {
      throw new BadRequestException("today must be YYYY-MM-DD");
    }
    const accountIds = (ids ?? "").split(",").filter(Boolean);
    return this.accounts.metrics(
      accountIds,
      today ? fromIsoDate(today) : fromIsoDate(toIsoDate(new Date())),
    );
  }

  @Get("net-worth")
  netWorth(): Promise<NetWorth> {
    return this.accounts.netWorth();
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createAccountSchema)) input: CreateAccountInput) {
    return toAccountDto(await this.accounts.create(input));
  }

  /** `POST /accounts/reorder` with `{ ids }` in their new order. */
  @Post("reorder")
  async reorder(@Body(new ZodValidationPipe(reorderAccountsSchema)) input: ReorderAccountsInput) {
    return (await this.accounts.reorder(input)).map(toAccountDto);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return toAccountDto(await this.accounts.findOne(id));
  }

  /** Replaces the account's details. The balance changes through `reconcile`. */
  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) input: UpdateAccountInput,
  ) {
    return toAccountDto(await this.accounts.update(id, input));
  }

  @Post(":id/archive")
  async archive(@Param("id") id: string) {
    return toAccountDto(await this.accounts.archive(id));
  }

  @Post(":id/unarchive")
  async unarchive(@Param("id") id: string) {
    return toAccountDto(await this.accounts.unarchive(id));
  }

  @Post(":id/default")
  async setDefault(@Param("id") id: string) {
    return toAccountDto(await this.accounts.setDefault(id));
  }

  @Post(":id/reconcile")
  async reconcile(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reconcileAccountSchema)) input: ReconcileAccountInput,
  ) {
    return toAccountDto(await this.accounts.reconcile(id, input));
  }
}
