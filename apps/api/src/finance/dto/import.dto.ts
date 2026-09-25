import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

/** How a bank's CSV maps onto transactions; saved on the account so the next import is one click. */
export const csvMappingSchema = z.object({
  hasHeader: z.boolean(),
  dateColumn: z.number().int().min(0),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "DD.MM.YYYY"]),
  amount: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("single"), column: z.number().int().min(0), invert: z.boolean() }),
    z.object({
      mode: z.literal("split"),
      debitColumn: z.number().int().min(0),
      creditColumn: z.number().int().min(0),
    }),
  ]),
  payeeColumn: z.number().int().min(0).nullable(),
  noteColumn: z.number().int().min(0).nullable(),
});
export type CsvMapping = z.infer<typeof csvMappingSchema>;

export const MAX_IMPORT_ROWS = 5000;

/** Rows already normalised by the browser (the preview is exactly what's sent). */
export const importTransactionsSchema = z.object({
  accountId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        date: isoDate,
        /** Signed: negative = money out. */
        amountMinor: minor.refine((n) => n !== 0, "amount can't be zero"),
        payee: z.string().trim().max(200).nullable(),
        note: z.string().trim().max(1000).nullable(),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
  /** Report what would happen to each row without writing anything. */
  dryRun: z.boolean().default(false),
  /** Also import rows that look like something already logged by hand. */
  includeMatched: z.boolean().default(false),
});
export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;

export const previewCsvSchema = z.object({
  accountId: z.string().uuid(),
  mapping: csvMappingSchema,
});
export type PreviewCsvInput = z.infer<typeof previewCsvSchema>;

export const commitCsvSchema = previewCsvSchema.extend({
  /** Also import rows that match something logged by hand. */
  includeMatched: z.boolean().default(false),
});
export type CommitCsvInput = z.infer<typeof commitCsvSchema>;

/** 2 MB: the same limit as the gateway, the BFF and the API's JSON body. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
