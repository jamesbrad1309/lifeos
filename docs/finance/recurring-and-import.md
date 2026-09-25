# Recurring Transactions & CSV Import

These are the two ways to get data in without typing every row by hand.

## Recurring rules

A `RecurringRule` (see [data-model.md](data-model.md)) describes a repeating
transaction: rent on the 1st, salary on the 25th, Netflix monthly.

### Schedule shape

Habit schedules (`schedule.util.ts`) are day-based: `daily`, `weekly`,
`timesPerWeek`, `interval`. Bills are mostly **monthly or yearly**, so the
finance module uses its own discriminated union, validated with zod the
same way:

```ts
type RecurringSchedule =
  | { type: "weekly"; dayOfWeek: number }            // 0–6
  | { type: "monthly"; dayOfMonth: number }          // 1–31, clamped to month length
  | { type: "yearly"; month: number; day: number };
```

`dayOfMonth: 31` in February becomes the 28th/29th, so rent due "on the last
day" still happens. Write `isDueOn(schedule, date)` for this union
alongside the habits version, as a pure function with unit tests.

### Generation: lazy and idempotent

There's no cron job and no queue. Generate transactions when they're
needed:

1. On any finance query (or on `onModuleInit`), call
   `RecurringService.catchUp(today)`.
2. For each active rule, walk dates from
   `lastGeneratedOn + 1` (or `startDate`) to `today`, and create a
   transaction for each due date.
3. Set `lastGeneratedOn = today`, **in the same `$transaction`** as the
   creates.

Because of step 3, running catch-up twice creates nothing the second time.
Restarting the server or skipping days is also safe: the next run fills the
gap. `upcomingBills(days)` uses the same walker for future dates but doesn't
write anything.

Changing a rule's amount only affects future generations. Past
transactions are real history.

## CSV import

Built: "Import CSV" on `/finance/transactions`. The file is parsed **on the
server**; the browser never interprets it.

### Flow

```
choose account + file
  → POST /uploads/transactions-csv?accountId=…   (multipart, BFF → API POST /imports)
      API stores it as <uuid>.csv, reads it once, answers { id, headers, sample, mapping }
  → adjust the column mapping           previewCsvImport(uploadId, accountId, mapping)
      dry run: every row's status and guessed category; nothing is written
  → Import                              commitCsvImport(…, includeMatched)
      inserts, remembers the mapping, deletes the file
  (Cancel / close)                      discardCsvImport(uploadId) deletes the file
```

- **The upload is temporary.** Files live in `os.tmpdir()/lifeos-imports`
  (directory `0700`, files `0600`), named by a server-generated UUID; the
  client's filename is never used. Import or cancel deletes it straight
  away, and a sweep every 15 minutes deletes anything older than an hour
  (a closed tab, or a failed import that was never retried).
- **Limits**: 2 MB per file (nginx `client_max_body_size`, the BFF route
  and Nest's `FileInterceptor` all enforce it) and 5,000 rows per import.
- **The BFF streams the upload** (`apps/bff/src/routes/uploads.ts`) to the
  API without buffering it: 415 if it isn't multipart, 413 when too big,
  502 if the API is down. Previews and commits are ordinary GraphQL
  mutations.
- **The mapping is remembered per account** in `Account.metadata.csvImport`
  together with the file's header row. The next upload reuses it only if
  the header row matches, so a different bank's export gets a fresh guess
  instead of a wrong mapping.

Code: `apps/api/src/finance/csv-uploads.{controller,service}.ts`,
`csv.util.ts` (pure parsing, unit-tested), `import.service.ts` (dedupe,
matching, categories); web `components/finance/transactions/CsvImportDialog.tsx`.

### Parsing

- `csv-parse` with `bom`, `relax_column_count`, `skip_empty_lines` and
  `trim`. Payees contain commas and quotes.
- **Date formats vary by bank.** `03/04/2026` is 3 April in the UK and
  March 4 in the US. The mapping carries `dateFormat`; the first guess
  picks a format every sample row fits, preferring day-first (as the UK
  and Vietnam write dates) when a file never shows a day above 12. The user can change it and the
  preview updates.
- **Amounts**: a single signed column (optionally inverted, for banks that
  show spending as positive) or separate money-out / money-in columns.
  `1,234.56`, `1.234,56`, `(12.00)`, `12.00 DR`, trailing minus and
  currency symbols are all understood, using the account currency's
  exponent (see [money-handling.md](money-handling.md)).
- Rows that can't be read are listed with their line number and skipped;
  they don't block the rest.

### Row statuses

| Status | Meaning | Imported? |
| ------ | ------- | --------- |
| New | Not seen before | Yes |
| Already imported | Same `importHash` as an earlier import | No |
| Already logged | Same account and amount as a hand-logged transaction within ±3 days (each matched once) | Only if "Also import rows that match…" is ticked |
| Before tracking started | Dated before the account's opening balance, which already includes it | No |

### Dedupe

```ts
importHash = sha256(`${accountId}|${date}|${amountMinor}|${foldPayee(payee)}|${occurrence}`)
```

- `occurrence` is the row's index among identical
  `(date, amount, payee)` rows in *this file*. Two genuine £3.50 coffees on
  the same day then both import, and re-importing the file still skips
  both.
- `foldPayee` ignores case, accents, apostrophes and spacing.
- Insert with `createManyAndReturn({ skipDuplicates: true })` in one
  transaction with the `monthly_totals` update. The
  `@@unique([accountId, importHash])` index settles a race between two
  imports of the same file.

### Auto-categorisation

Each row gets, in order:

1. the category the same payee was last filed under (quick log, the form or
   an earlier import);
2. a category whose name or alias appears as whole words in the payee
   ("TESCO STORES 3245" → Groceries, "SAINSBURY'S" → Groceries);
3. nothing: the row lands in "To review".

Money in only matches income categories and money out only expense ones.
Still to do: user-written rules (`"TESCO*" → Groceries`), and offering to
create one when an imported row is recategorised.

