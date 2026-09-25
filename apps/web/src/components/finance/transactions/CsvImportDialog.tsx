import { useMutation, useQuery } from "@apollo/client/react";
import { Loader2, Upload } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Amount } from "#components/finance/Amount";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  COMMIT_CSV_IMPORT_MUTATION,
  DISCARD_CSV_IMPORT_MUTATION,
  PREVIEW_CSV_IMPORT_MUTATION,
  TRANSACTIONS_REFETCH,
} from "#graphql/finance";
import type {
  AccountsData,
  CsvDateFormat,
  CsvImportPreview,
  CsvMapping,
  CsvUpload,
  ImportRowStatus,
} from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { formatShortDate } from "#lib/dates";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DATE_FORMATS: CsvDateFormat[] = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "DD.MM.YYYY",
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

const STATUS_CLASS: Record<ImportRowStatus, string> = {
  NEW: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  DUPLICATE: "bg-muted text-muted-foreground",
  MATCHED: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  BEFORE_OPENING: "bg-muted text-muted-foreground",
};

/** Sends the file to the server, which keeps it only until it's imported or discarded. */
async function uploadCsv(file: File, accountId: string): Promise<CsvUpload> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    `/uploads/transactions-csv?accountId=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      body: form,
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error((body as { message?: string }).message ?? `Upload failed (${response.status})`);
  return body as CsvUpload;
}

/**
 * Bank CSV → transactions, all on the server: the file is uploaded, the
 * server parses it with the column mapping and answers a dry-run preview
 * (new, already imported, already logged by hand, before tracking started),
 * then imports it and deletes the file. Closing without importing deletes
 * the upload too.
 */
export function CsvImportDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const accounts = data?.accounts ?? [];

  const [accountId, setAccountId] = useState("");
  const [upload, setUpload] = useState<CsvUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [includeMatched, setIncludeMatched] = useState(false);

  const [previewCsv, previewState] = useMutation<{ previewCsvImport: CsvImportPreview }>(
    PREVIEW_CSV_IMPORT_MUTATION,
  );
  const [commitCsv, commitState] = useMutation<{ commitCsvImport: { imported: number } }>(
    COMMIT_CSV_IMPORT_MUTATION,
    { refetchQueries: TRANSACTIONS_REFETCH, awaitRefetchQueries: true },
  );
  const [discardCsv] = useMutation(DISCARD_CSV_IMPORT_MUTATION);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAccountId(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
      setUpload(null);
      setMapping(null);
      setError(null);
      setIncludeMatched(false);
      previewState.reset();
    }
  }

  /** Closing without importing: the server deletes the file now rather than at the hourly sweep. */
  function close() {
    if (upload) void discardCsv({ variables: { uploadId: upload.id } }).catch(() => {});
    setUpload(null);
    onOpenChange(false);
  }

  async function chooseFile(file: File) {
    if (upload) void discardCsv({ variables: { uploadId: upload.id } }).catch(() => {});
    setError(null);
    setUpload(null);
    setMapping(null);
    setUploading(true);
    try {
      const uploaded = await uploadCsv(file, accountId);
      setUpload(uploaded);
      setMapping(uploaded.mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("finance.import.readError"));
    } finally {
      setUploading(false);
    }
  }

  // Re-run the server's dry run when the mapping or account changes, once edits settle.
  useEffect(() => {
    if (!upload || !mapping || !accountId) return;
    const timer = setTimeout(() => {
      void previewCsv({ variables: { uploadId: upload.id, accountId, mapping } }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [upload, mapping, accountId, previewCsv]);

  const preview = previewState.loading ? undefined : previewState.data?.previewCsvImport;
  const importCount = preview ? preview.new + (includeMatched ? preview.matched : 0) : 0;

  async function handleImport() {
    if (!upload || !mapping) return;
    try {
      const result = await commitCsv({
        variables: { uploadId: upload.id, accountId, mapping, includeMatched },
      });
      setUpload(null);
      onOpenChange(false);
      toast(t("finance.import.done", { count: result.data?.commitCsvImport.imported ?? 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  const columnCount = upload ? Math.max(...upload.sample.map((r) => r.length)) : 0;
  const sampleRow = upload?.sample[mapping?.hasHeader ? 1 : 0] ?? [];
  const columns = [...Array(columnCount).keys()];
  const columnOptions = columns.map((column) => {
    const name =
      mapping?.hasHeader && upload?.sample[0]?.[column]
        ? upload.sample[0][column]
        : t("finance.import.column", { n: column + 1 });
    const sample = sampleRow[column] ?? "";
    return (
      <option key={column} value={column}>
        {name}
        {sample ? ` · ${sample.slice(0, 24)}` : ""}
      </option>
    );
  });
  const update = (patch: Partial<CsvMapping>) => setMapping((m) => (m ? { ...m, ...patch } : m));
  const columnSelect = (
    id: string,
    value: number | null,
    onChange: (v: number | null) => void,
    allowNone = false,
  ) => (
    <select
      id={id}
      className={selectClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {allowNone && <option value="">{t("finance.import.none")}</option>}
      {columnOptions}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("finance.import.title")}</DialogTitle>
          <DialogDescription>{t("finance.import.hint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("finance.import.account")} id="import-account">
            <select
              id="import-account"
              className={selectClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("finance.import.file")} id="import-file">
            <div className="flex items-center gap-2">
              <input
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={uploading || !accountId}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void chooseFile(file);
                }}
                className="min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
              {uploading && (
                <Loader2
                  className="size-4 animate-spin text-muted-foreground"
                  aria-label={t("common.loading")}
                />
              )}
            </div>
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {upload && mapping && (
          <>
            <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">{t("finance.import.mapping")}</legend>
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={mapping.hasHeader}
                  onChange={(e) => update({ hasHeader: e.target.checked })}
                />
                {t("finance.import.hasHeader")}
              </label>
              <Field label={t("finance.import.dateColumn")} id="map-date">
                {columnSelect("map-date", mapping.dateColumn, (v) =>
                  update({ dateColumn: v ?? 0 }),
                )}
              </Field>
              <Field label={t("finance.import.dateFormat")} id="map-date-format">
                <select
                  id="map-date-format"
                  className={selectClass}
                  value={mapping.dateFormat}
                  onChange={(e) => update({ dateFormat: e.target.value as CsvDateFormat })}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("finance.import.amountMode")} id="map-amount-mode">
                <select
                  id="map-amount-mode"
                  className={selectClass}
                  value={mapping.amount.mode}
                  onChange={(e) =>
                    update({
                      amount:
                        e.target.value === "split"
                          ? {
                              mode: "split",
                              debitColumn: 0,
                              creditColumn: Math.min(1, columnCount - 1),
                            }
                          : { mode: "single", column: 0, invert: false },
                    })
                  }
                >
                  <option value="single">{t("finance.import.single")}</option>
                  <option value="split">{t("finance.import.split")}</option>
                </select>
              </Field>
              {mapping.amount.mode === "single" ? (
                <>
                  <Field label={t("finance.import.amountColumn")} id="map-amount">
                    {columnSelect(
                      "map-amount",
                      mapping.amount.column,
                      (v) =>
                        mapping.amount.mode === "single" &&
                        update({ amount: { ...mapping.amount, column: v ?? 0 } }),
                    )}
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={mapping.amount.invert}
                      onChange={(e) =>
                        mapping.amount.mode === "single" &&
                        update({ amount: { ...mapping.amount, invert: e.target.checked } })
                      }
                    />
                    {t("finance.import.invert")}
                  </label>
                </>
              ) : (
                <>
                  <Field label={t("finance.import.debitColumn")} id="map-debit">
                    {columnSelect(
                      "map-debit",
                      mapping.amount.debitColumn,
                      (v) =>
                        mapping.amount.mode === "split" &&
                        update({ amount: { ...mapping.amount, debitColumn: v ?? 0 } }),
                    )}
                  </Field>
                  <Field label={t("finance.import.creditColumn")} id="map-credit">
                    {columnSelect(
                      "map-credit",
                      mapping.amount.creditColumn,
                      (v) =>
                        mapping.amount.mode === "split" &&
                        update({ amount: { ...mapping.amount, creditColumn: v ?? 0 } }),
                    )}
                  </Field>
                  <span className="hidden sm:block" />
                </>
              )}
              <Field label={t("finance.import.payeeColumn")} id="map-payee">
                {columnSelect(
                  "map-payee",
                  mapping.payeeColumn,
                  (v) => update({ payeeColumn: v }),
                  true,
                )}
              </Field>
              <Field label={t("finance.import.noteColumn")} id="map-note">
                {columnSelect(
                  "map-note",
                  mapping.noteColumn,
                  (v) => update({ noteColumn: v }),
                  true,
                )}
              </Field>
            </fieldset>

            <div className="flex flex-col gap-2">
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-live="polite">
                {!preview ? (
                  <span className="text-muted-foreground">{t("finance.import.checking")}</span>
                ) : (
                  <>
                    <span className="font-medium">
                      {t("finance.import.summary.new", { count: preview.new })}
                    </span>
                    {preview.duplicates > 0 && (
                      <span className="text-muted-foreground">
                        {t("finance.import.summary.duplicates", { count: preview.duplicates })}
                      </span>
                    )}
                    {preview.matched > 0 && (
                      <span className="text-amber-700 dark:text-amber-400">
                        {t("finance.import.summary.matched", { count: preview.matched })}
                      </span>
                    )}
                    {preview.beforeOpening > 0 && (
                      <span className="text-muted-foreground">
                        {t("finance.import.summary.beforeOpening", {
                          count: preview.beforeOpening,
                        })}
                      </span>
                    )}
                    {preview.problems.length > 0 && (
                      <span className="text-destructive">
                        {t("finance.import.summary.problems", { count: preview.problems.length })}
                      </span>
                    )}
                  </>
                )}
              </p>

              {preview && preview.matched > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={includeMatched}
                    onChange={(e) => setIncludeMatched(e.target.checked)}
                  />
                  {t("finance.import.includeMatched")}
                </label>
              )}

              {preview && preview.rows.length > 0 && (
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2 font-medium">{t("finance.import.date")}</th>
                        <th className="px-3 py-2 font-medium">{t("finance.import.payee")}</th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t("finance.import.amount")}
                        </th>
                        <th className="px-3 py-2 font-medium">{t("finance.import.category")}</th>
                        <th className="px-3 py-2 font-medium">{t("finance.import.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.rows.map((row) => (
                        <tr key={row.line} className={cn(row.status !== "NEW" && "opacity-60")}>
                          <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                            {formatShortDate(row.date)}
                          </td>
                          <td className="max-w-64 truncate px-3 py-1.5">
                            {row.payee ?? row.note ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <Amount minor={row.amountMinor} currency={preview.currency} />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {row.category
                              ? `${row.category.icon ?? ""} ${categoryName(row.category)}`
                              : t("finance.toReview")}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs whitespace-nowrap",
                                STATUS_CLASS[row.status],
                              )}
                            >
                              {t(`finance.import.statuses.${row.status}`)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.total > preview.rows.length && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {t("finance.import.moreRows", { count: preview.total - preview.rows.length })}
                    </p>
                  )}
                </div>
              )}

              {preview && preview.problems.length > 0 && (
                <ul className="max-h-24 overflow-auto text-xs text-destructive">
                  {preview.problems.slice(0, 20).map((p) => (
                    <li key={p.line}>
                      {t("finance.import.problemLine", {
                        line: p.line,
                        what:
                          p.reason === "date"
                            ? t("finance.import.problemDate")
                            : t("finance.import.problemAmount"),
                        value: p.value,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!preview || importCount === 0 || commitState.loading}
            onClick={() => void handleImport()}
          >
            <Upload className="size-4" />
            {t("finance.import.importCount", { count: importCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
