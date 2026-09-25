import { Module } from "@nestjs/common";
import { AccountsController } from "#finance/accounts.controller";
import { AccountsService } from "#finance/accounts.service";
import { BudgetsController } from "#finance/budgets.controller";
import { BudgetsService } from "#finance/budgets.service";
import { CategoriesController } from "#finance/categories.controller";
import { CategoriesService } from "#finance/categories.service";
import { CsvUploadsController } from "#finance/csv-uploads.controller";
import { CsvUploadsService } from "#finance/csv-uploads.service";
import { CurrenciesController } from "#finance/currencies.controller";
import { CurrenciesService } from "#finance/currencies.service";
import { ExchangeRatesService } from "#finance/exchange-rates.service";
import { ImportService } from "#finance/import.service";
import { MonthlyTotalsService } from "#finance/monthly-totals.service";
import { QuickLogController } from "#finance/quick-log.controller";
import { QuickLogService } from "#finance/quick-log.service";
import { ReportsController } from "#finance/reports.controller";
import { ReportsService } from "#finance/reports.service";
import { TransactionsController } from "#finance/transactions.controller";
import { TransactionsService } from "#finance/transactions.service";

/**
 * One module for all of finance: accounts, transactions, budgets and
 * reports are tightly coupled. Built so far (docs/finance/index.md): accounts
 * and reconciling (phase 1), transactions and quick log (phase 2), and spend
 * by category from the `monthly_totals` aggregate (phase 2b), budgets (phase 3).
 */
@Module({
  controllers: [
    AccountsController,
    CategoriesController,
    TransactionsController,
    QuickLogController,
    ReportsController,
    BudgetsController,
    CurrenciesController,
    CsvUploadsController,
  ],
  providers: [
    AccountsService,
    CategoriesService,
    TransactionsService,
    QuickLogService,
    MonthlyTotalsService,
    ReportsService,
    BudgetsService,
    CurrenciesService,
    ExchangeRatesService,
    ImportService,
    CsvUploadsService,
  ],
})
export class FinanceModule {}
