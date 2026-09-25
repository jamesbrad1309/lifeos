import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { type CurrenciesOverview, CurrenciesService } from "#finance/currencies.service";
import {
  type AddCurrencyInput,
  type SetOverrideInput,
  addCurrencySchema,
  currencyCode,
  setOverrideSchema,
} from "#finance/dto/currency.dto";
import { ExchangeRatesService, type RefreshResult } from "#finance/exchange-rates.service";

@Controller("currencies")
export class CurrenciesController {
  constructor(
    private readonly currencies: CurrenciesService,
    private readonly rates: ExchangeRatesService,
  ) {}

  /** `GET /currencies`: the ones in use, with today's rates to the main currency. */
  @Get()
  overview(): Promise<CurrenciesOverview> {
    return this.currencies.overview();
  }

  @Post()
  @HttpCode(204)
  async add(
    @Body(new ZodValidationPipe(addCurrencySchema)) input: AddCurrencyInput,
  ): Promise<void> {
    await this.currencies.add(input.code);
  }

  /** `POST /currencies/refresh-rates`: fetch today's rates now instead of waiting. */
  @Post("refresh-rates")
  refresh(): Promise<RefreshResult> {
    return this.rates.refresh();
  }

  @Delete(":code")
  @HttpCode(204)
  async remove(@Param("code", new ZodValidationPipe(currencyCode)) code: string): Promise<void> {
    await this.currencies.remove(code);
  }

  @Post(":code/main")
  @HttpCode(204)
  async setMain(@Param("code", new ZodValidationPipe(currencyCode)) code: string): Promise<void> {
    await this.currencies.setMain(code);
  }

  @Put(":code/override")
  @HttpCode(204)
  async setOverride(
    @Param("code", new ZodValidationPipe(currencyCode)) code: string,
    @Body(new ZodValidationPipe(setOverrideSchema)) input: SetOverrideInput,
  ): Promise<void> {
    await this.currencies.setOverride(code, input.rateToMain);
  }
}
