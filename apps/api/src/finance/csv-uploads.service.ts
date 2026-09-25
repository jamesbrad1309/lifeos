import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { type CsvMapping, type CsvProblem, applyMapping, guessMapping } from "#finance/csv.util";
import { MAX_IMPORT_ROWS } from "#finance/dto/import.dto";
import { type ImportResult, type ImportRowStatus, ImportService } from "#finance/import.service";

const log = scopedLogger("CsvUploadsService");

/** Uploaded files live here only until imported, discarded or swept. */
const UPLOAD_DIR = join(tmpdir(), "lifeos-imports");
/** Abandoned uploads (dialog closed, tab gone) are deleted after this. */
const MAX_AGE_MS = 60 * 60 * 1000;
const SWEEP_EVERY_MS = 15 * 60 * 1000;
const PREVIEW_ROWS = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface CsvUpload {
  id: string;
  /** Data rows in the file (after a header, if there is one). */
  rowCount: number;
  /** Header names, or "" for files without one. */
  headers: string[];
  /** The first few records as the file has them, to label column pickers. */
  sample: string[][];
  /** A first guess, or the account's saved mapping when it fits. */
  mapping: CsvMapping;
}

export interface CsvPreviewRow {
  line: number;
  date: string;
  amountMinor: number;
  payee: string | null;
  note: string | null;
  status: ImportRowStatus;
  categoryId: string | null;
}

export interface CsvPreview {
  currency: string;
  /** The first 200 rows; counts cover the whole file. */
  rows: CsvPreviewRow[];
  total: number;
  new: number;
  duplicates: number;
  matched: number;
  beforeOpening: number;
  problems: CsvProblem[];
}

/** What an account remembers about its last import: the mapping, and the header row it was for. */
interface SavedCsvImport {
  mapping: CsvMapping;
  /** The file's first row, folded: the same bank's exports share it. */
  signature: string;
}

/** A file's first row, folded, identifying the bank's export format. */
function signatureOf(records: string[][]): string {
  return (records[0] ?? []).map((cell) => cell.trim().toLowerCase()).join("|");
}

/**
 * Server-side CSV import: the browser uploads the bank's file, this parses
 * it (never trusting client-side parsing), previews it as a dry run, imports
 * it, and deletes it. Files are named by a server-generated UUID in a
 * private temp directory, never by what the client sent.
 */
@Injectable()
export class CsvUploadsService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly imports: ImportService,
  ) {}

  async onModuleInit(): Promise<void> {
    await mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Stores an uploaded file and reads it once, to reject non-CSV early and describe its columns. */
  async upload(content: Buffer, accountId: string | undefined): Promise<CsvUpload> {
    const records = this.parse(content);
    if (records.length === 0) throw new BadRequestException("The file has no rows");
    const id = randomUUID();
    await writeFile(this.pathOf(id), content, { mode: 0o600 });

    // Reuse the account's last mapping only for the same export format
    // (identical header row); otherwise guess afresh.
    const account = accountId
      ? await this.prisma.account.findUnique({ where: { id: accountId } })
      : null;
    const saved = (account?.metadata as { csvImport?: SavedCsvImport } | null)?.csvImport;
    const mapping =
      saved && saved.signature === signatureOf(records) ? saved.mapping : guessMapping(records);
    const headers = mapping.hasHeader ? records[0] : records[0].map(() => "");
    log.info({ uploadId: id, bytes: content.length, rows: records.length }, "csv uploaded");
    return {
      id,
      rowCount: records.length - (mapping.hasHeader ? 1 : 0),
      headers,
      sample: records.slice(0, 6),
      mapping,
    };
  }

  /** What importing the file with `mapping` would do, row by row. Writes nothing. */
  async preview(id: string, accountId: string, mapping: CsvMapping): Promise<CsvPreview> {
    const { rows, problems, currency } = await this.rows(id, accountId, mapping);
    if (rows.length === 0) {
      return {
        currency,
        rows: [],
        total: 0,
        new: 0,
        duplicates: 0,
        matched: 0,
        beforeOpening: 0,
        problems,
      };
    }
    const result = await this.run(accountId, rows, { dryRun: true });
    return {
      currency,
      rows: rows.slice(0, PREVIEW_ROWS).map((row, i) => ({
        ...row,
        status: result.rows[i].status,
        categoryId: result.rows[i].categoryId,
      })),
      total: rows.length,
      new: result.rows.filter((r) => r.status === "new").length,
      duplicates: result.duplicates,
      matched: result.matched,
      beforeOpening: result.beforeOpening,
      problems: problems.slice(0, 50),
    };
  }

  /** Imports the file, remembers the mapping for this export format, then deletes the file. */
  async commit(
    id: string,
    accountId: string,
    mapping: CsvMapping,
    includeMatched: boolean,
  ): Promise<ImportResult> {
    const { rows, records } = await this.rows(id, accountId, mapping);
    if (rows.length === 0) throw new BadRequestException("No readable rows with this mapping");
    const result = await this.run(accountId, rows, { dryRun: false, includeMatched });
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const saved: SavedCsvImport = { mapping, signature: signatureOf(records) };
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        metadata: {
          ...(account.metadata as object),
          csvImport: saved,
        } as unknown as Prisma.InputJsonObject,
      },
    });
    await this.discard(id);
    return result;
  }

  async discard(id: string): Promise<void> {
    await rm(this.pathOf(id), { force: true });
    log.info({ uploadId: id }, "csv upload deleted");
  }

  /** Deletes uploads nobody finished. */
  async sweep(): Promise<void> {
    try {
      const now = Date.now();
      for (const name of await readdir(UPLOAD_DIR)) {
        const path = join(UPLOAD_DIR, name);
        if (now - (await stat(path)).mtimeMs > MAX_AGE_MS) {
          await rm(path, { force: true });
          log.info({ file: name }, "abandoned csv upload deleted");
        }
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "csv upload sweep failed");
    }
  }

  private pathOf(id: string): string {
    if (!UUID.test(id)) throw new BadRequestException("Invalid upload id");
    return join(UPLOAD_DIR, `${id}.csv`);
  }

  private parse(content: Buffer): string[][] {
    try {
      return (
        parse(content, {
          bom: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true,
        }) as string[][]
      ).filter((record) => record.length > 1);
    } catch (err) {
      throw new BadRequestException(`That file isn't a readable CSV (${(err as Error).message})`);
    }
  }

  private async rows(id: string, accountId: string, mapping: CsvMapping) {
    let content: Buffer;
    try {
      content = await readFile(this.pathOf(id));
    } catch {
      throw new NotFoundException(
        "That upload has expired or was already imported; choose the file again",
      );
    }
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    const records = this.parse(content);
    const { rows, problems } = applyMapping(records, mapping, account.currency);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `${rows.length} rows; import at most ${MAX_IMPORT_ROWS} at a time`,
      );
    }
    return { rows, problems, records, currency: account.currency };
  }

  private run(
    accountId: string,
    rows: { date: string; amountMinor: number; payee: string | null; note: string | null }[],
    options: { dryRun: boolean; includeMatched?: boolean },
  ): Promise<ImportResult> {
    return this.imports.importRows({
      accountId,
      rows: rows.map(({ date, amountMinor, payee, note }) => ({ date, amountMinor, payee, note })),
      dryRun: options.dryRun,
      includeMatched: options.includeMatched ?? false,
    });
  }
}
