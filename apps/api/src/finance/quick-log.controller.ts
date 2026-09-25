import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type CreateQuickPresetInput,
  type QuickLogContextInput,
  type QuickLogInput,
  createQuickPresetSchema,
  quickLogContextSchema,
  quickLogSchema,
} from "#finance/dto/quick-log.dto";
import { QuickLogService } from "#finance/quick-log.service";
import { toTransactionDto } from "#finance/transactions.controller";

@Controller("quick-log")
export class QuickLogController {
  constructor(private readonly quickLog: QuickLogService) {}

  /** `GET /quick-log/context?hour=8&dayOfWeek=3&utcOffsetMinutes=-60` */
  @Get("context")
  context(@Query(new ZodValidationPipe(quickLogContextSchema)) input: QuickLogContextInput) {
    return this.quickLog.context(input);
  }

  @Post()
  async log(@Body(new ZodValidationPipe(quickLogSchema)) input: QuickLogInput) {
    const result = await this.quickLog.quickLog(input);
    return { ...result, transaction: toTransactionDto(result.transaction) };
  }

  @Get("presets")
  presets() {
    return this.quickLog.listPresets();
  }

  @Post("presets")
  createPreset(
    @Body(new ZodValidationPipe(createQuickPresetSchema)) input: CreateQuickPresetInput,
  ) {
    return this.quickLog.createPreset(input);
  }

  @Delete("presets/:id")
  deletePreset(@Param("id") id: string) {
    return this.quickLog.deletePreset(id);
  }
}
