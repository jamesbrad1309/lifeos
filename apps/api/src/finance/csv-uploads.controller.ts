import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { type CsvPreview, type CsvUpload, CsvUploadsService } from "#finance/csv-uploads.service";
import {
  type CommitCsvInput,
  MAX_UPLOAD_BYTES,
  type PreviewCsvInput,
  commitCsvSchema,
  previewCsvSchema,
} from "#finance/dto/import.dto";
import type { ImportResult } from "#finance/import.service";

/**
 * Bank CSV import, all on the server: upload the file → preview it with a
 * column mapping (a dry run) → commit, which imports and deletes the file.
 * `DELETE` discards an upload; abandoned ones are swept after an hour.
 */
@Controller("imports")
export class CsvUploadsController {
  constructor(private readonly uploads: CsvUploadsService) {}

  /** `POST /imports?accountId=…` with multipart field `file`. */
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("accountId") accountId?: string,
  ): Promise<CsvUpload> {
    if (!file) throw new BadRequestException("Send the CSV as multipart field `file`");
    return this.uploads.upload(file.buffer, accountId);
  }

  @Post(":id/preview")
  preview(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(previewCsvSchema)) input: PreviewCsvInput,
  ): Promise<CsvPreview> {
    return this.uploads.preview(id, input.accountId, input.mapping);
  }

  @Post(":id/commit")
  commit(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commitCsvSchema)) input: CommitCsvInput,
  ): Promise<ImportResult> {
    return this.uploads.commit(id, input.accountId, input.mapping, input.includeMatched);
  }

  @Delete(":id")
  @HttpCode(204)
  async discard(@Param("id") id: string): Promise<void> {
    await this.uploads.discard(id);
  }
}
