import { BadRequestException, Controller, Get, Post, Query } from "@nestjs/common";
import { MonthlyTotalsService, type RebuildResult } from "#finance/monthly-totals.service";
import { ReportsService, type SpendReport } from "#finance/reports.service";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f-]{36}$/i;

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly totals: MonthlyTotalsService,
  ) {}

  /** `GET /reports/spend-by-category?month=2026-09[&accountId=…]` */
  @Get("spend-by-category")
  spendByCategory(
    @Query("month") month?: string,
    @Query("accountId") accountId?: string,
  ): Promise<SpendReport> {
    if (!month || !MONTH.test(month)) throw new BadRequestException("month must be YYYY-MM");
    if (accountId !== undefined && !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a UUID");
    }
    return this.reports.spendByCategory(month, accountId);
  }

  /**
   * Recounts `monthly_totals` from transactions. Reports how many rows had
   * drifted, so it doubles as a consistency check (0 = the totals were right).
   */
  @Post("monthly-totals/rebuild")
  rebuild(): Promise<RebuildResult> {
    return this.totals.rebuild();
  }
}
