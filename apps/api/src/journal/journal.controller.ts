import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type CreateJournalEntriesInput,
  type JournalEntryInput,
  createJournalEntriesSchema,
  journalEntrySchema,
} from "#journal/dto/journal-entry.dto";
import {
  type JournalDaySummary,
  type JournalEntryWithTrigger,
  JournalService,
} from "#journal/journal.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(name: string, value: string | undefined): string {
  if (!value || !ISO_DATE.test(value)) {
    throw new BadRequestException(`${name} must be YYYY-MM-DD`);
  }
  return value;
}

/** `date` is a `@db.Date` column — send it as plain "YYYY-MM-DD", like habit entries. */
function toEntryDto(entry: JournalEntryWithTrigger) {
  return { ...entry, date: entry.date.toISOString().slice(0, 10) };
}

@Controller("journal-entries")
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  /** `GET /journal-entries?date=2026-09-24` — one day's timeline, in time order. */
  @Get()
  async findForDate(@Query("date") date?: string) {
    const entries = await this.journalService.findForDate(assertIsoDate("date", date));
    return entries.map(toEntryDto);
  }

  /** `GET /journal-entries/days?from=…&to=…` — per-day counts for the week strip. */
  @Get("days")
  summarize(@Query("from") from?: string, @Query("to") to?: string): Promise<JournalDaySummary[]> {
    return this.journalService.summarize(assertIsoDate("from", from), assertIsoDate("to", to));
  }

  @Post()
  async create(@Body(new ZodValidationPipe(journalEntrySchema)) input: JournalEntryInput) {
    return toEntryDto(await this.journalService.create(input));
  }

  /** `POST /journal-entries/batch` — a composer list, saved atomically. */
  @Post("batch")
  async createMany(
    @Body(new ZodValidationPipe(createJournalEntriesSchema)) input: CreateJournalEntriesInput,
  ) {
    return (await this.journalService.createMany(input)).map(toEntryDto);
  }

  @Put(":id")
  async replace(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(journalEntrySchema)) input: JournalEntryInput,
  ) {
    return toEntryDto(await this.journalService.replace(id, input));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const entry = await this.journalService.remove(id);
    return { id: entry.id };
  }
}
