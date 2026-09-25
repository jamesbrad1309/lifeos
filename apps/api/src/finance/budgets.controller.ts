import { Body, Controller, Get, HttpCode, Post, Put, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { type BudgetReport, BudgetsService } from "#finance/budgets.service";
import { toIsoDate } from "#finance/calendar.util";
import {
  type BudgetReportInput,
  type RemoveBudgetInput,
  type SetBudgetInput,
  budgetReportSchema,
  removeBudgetSchema,
  setBudgetSchema,
} from "#finance/dto/budget.dto";

@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  /** `GET /budgets?month=2026-09&today=2026-09-25`: budget vs actual, with pace. */
  @Get()
  report(
    @Query(new ZodValidationPipe(budgetReportSchema)) input: BudgetReportInput,
  ): Promise<BudgetReport> {
    return this.budgets.report(input.month, input.today ?? toIsoDate(new Date()));
  }

  /** `PUT /budgets`: sets a category's limit from `month` on. */
  @Put()
  @HttpCode(204)
  async set(@Body(new ZodValidationPipe(setBudgetSchema)) input: SetBudgetInput): Promise<void> {
    await this.budgets.set(input);
  }

  /** `POST /budgets/remove`: no budget for the category from `month` on. */
  @Post("remove")
  @HttpCode(204)
  async remove(
    @Body(new ZodValidationPipe(removeBudgetSchema)) input: RemoveBudgetInput,
  ): Promise<void> {
    await this.budgets.remove(input.categoryId, input.month);
  }
}
