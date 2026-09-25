import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ChartBar, ChevronLeft, ChevronRight, Table2, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { moneyToneClass } from "#components/finance/Amount";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { ACCOUNTS_QUERY, SPEND_BY_CATEGORY_QUERY } from "#graphql/finance";
import type { AccountsData, CategorySpend, SpendReport } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { useStoredState } from "#hooks/useStoredState";
import { addMonths, currentMonth, formatMonth, formatMonthName } from "#lib/dates";
import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

export interface SpendingSearch {
  month?: string;
  account?: string;
}

interface Props {
  search: SpendingSearch;
  onSearchChange: (next: Partial<SpendingSearch>) => void;
}

const monthName = formatMonthName;

/**
 * Where the money went this month, by category, against last month. Read
 * from the pre-summed `monthly_totals` table, so it costs the same whether
 * the month has ten transactions or ten thousand.
 */
export function SpendingView({ search, onSearchChange }: Props) {
  const { t } = useTranslation();
  const month = search.month ?? currentMonth();
  const { data, error } = useQuery<{ spendByCategory: SpendReport }>(SPEND_BY_CATEGORY_QUERY, {
    variables: { month, accountId: search.account ?? null },
  });
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const [asTable, setAsTable] = useStoredState("lifeos.spending.asTable", false);

  const report = data?.spendByCategory;
  const accounts = accountsData?.accounts ?? [];
  // Every figure in the report is converted to the main currency server-side.
  const currency = report?.currency ?? "GBP";
  const previous = addMonths(month, -1);

  return (
    <div className="flex flex-col gap-6">
      {/* Filters in one row above the chart. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.previousMonth")}
            onClick={() => onSearchChange({ month: addMonths(month, -1) })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-24 text-center text-sm font-medium">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.nextMonth")}
            disabled={month >= currentMonth()}
            onClick={() => onSearchChange({ month: addMonths(month, 1) })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <select
          aria-label={t("finance.transactions.account")}
          value={search.account ?? ""}
          onChange={(e) => onSearchChange({ account: e.target.value || undefined })}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{t("common.allAccounts")}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-destructive">{error.message}</p>}

      {report && (
        <>
          <Headline report={report} currency={currency} month={month} previous={previous} />
          <UnconvertedNote codes={report.unconverted} />

          {report.categories.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("finance.spending.noSpending", { month: formatMonth(month) })}
              </p>
              <p className="mt-1">{t("finance.spending.noSpendingBody")}</p>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">{t("finance.spending.byCategory")}</h2>
                  <div className="flex items-center gap-4">
                    {!asTable && (
                      <ul
                        className="flex items-center gap-3 text-xs text-muted-foreground"
                        aria-label={t("finance.spending.legend")}
                      >
                        <li className="flex items-center gap-1.5">
                          <span className="h-2.5 w-4 rounded-sm bg-viz-series-1" />
                          {monthName(month)}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="h-3 w-0.5 rounded-full bg-viz-reference" />
                          {monthName(previous)}
                        </li>
                      </ul>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={asTable}
                      onClick={() => setAsTable(!asTable)}
                    >
                      {asTable ? (
                        <ChartBar className="size-3.5" />
                      ) : (
                        <Table2 className="size-3.5" />
                      )}
                      {asTable ? t("finance.spending.chart") : t("finance.spending.table")}
                    </Button>
                  </div>
                </div>
                {asTable ? (
                  <SpendTable
                    report={report}
                    currency={currency}
                    month={month}
                    previous={previous}
                  />
                ) : (
                  <SpendBars
                    report={report}
                    currency={currency}
                    month={month}
                    previous={previous}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

interface ChartProps {
  report: SpendReport;
  currency: string;
  month: string;
  previous: string;
}

/** The one number the page leads with, and how it compares. */
function Headline({ report, currency, month, previous }: ChartProps) {
  const { t } = useTranslation();
  const change = report.spentMinor - report.previousSpentMinor;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div>
        <p className="text-sm text-muted-foreground">
          {t("finance.spending.spentIn", { month: monthName(month) })}
        </p>
        <p className="text-5xl font-semibold tracking-tight">
          {formatMoney(report.spentMinor, currency)}
        </p>
      </div>
      <dl className="flex gap-6 pb-1.5 text-sm">
        <div>
          <dt className="text-muted-foreground">
            {t("finance.spending.vs", { month: monthName(previous) })}
          </dt>
          {/* Spending more than last month is money lost: red; less is green. */}
          <dd className={cn("font-medium tabular-nums", moneyToneClass(-change))}>
            {report.previousSpentMinor === 0 && report.spentMinor === 0
              ? "—"
              : change > 0
                ? t("finance.spending.more", { amount: formatMoney(change, currency) })
                : change < 0
                  ? t("finance.spending.less", { amount: formatMoney(-change, currency) })
                  : t("finance.spending.same")}
          </dd>
        </div>
        {report.incomeMinor !== 0 && (
          <div>
            <dt className="text-muted-foreground">{t("finance.spending.income")}</dt>
            <dd className={cn("font-medium tabular-nums", moneyToneClass(report.incomeMinor))}>
              {formatMoney(report.incomeMinor, currency)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Each row opens its transactions: the category for the month, or the review inbox. */
function RowLink({
  c,
  month,
  className,
  children,
}: { c: CategorySpend; month: string; className?: string; children: ReactNode }) {
  return c.category ? (
    <Link
      to="/finance/transactions"
      search={{ view: "all", month, category: c.category.id }}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <Link to="/finance/transactions" search={{ view: "review" }} className={className}>
      {children}
    </Link>
  );
}

/**
 * Horizontal bars, biggest first: this month as the bar, last month as a
 * thin reference tick on the same scale. One hue; the numbers are always
 * written beside the bars, so nothing depends on reading length alone.
 */
function SpendBars({ report, currency, month, previous }: ChartProps) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(
    1,
    ...report.categories.flatMap((c) => [c.spentMinor, c.previousSpentMinor]),
  );
  const pct = (minor: number) => `${(Math.max(0, minor) / max) * 100}%`;

  return (
    <ol className="flex flex-col gap-1">
      {report.categories.map((c, i) => {
        const share =
          report.spentMinor > 0 ? Math.round((c.spentMinor / report.spentMinor) * 100) : 0;
        const change = c.spentMinor - c.previousSpentMinor;
        return (
          <li
            key={c.category?.id ?? "uncategorised"}
            className={cn("relative", hovered === i && "z-10")}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
          >
            <RowLink
              c={c}
              month={month}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem]"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {c.category?.icon ?? "•"}
                </span>
                <span
                  className={cn("truncate", !c.category && "text-amber-700 dark:text-amber-400")}
                >
                  {categoryName(c.category)}
                </span>
              </span>

              {/* The plot: hit target is the whole row, the mark stays thin. */}
              <span className="relative h-5" aria-hidden>
                <span
                  className="absolute inset-y-0.5 left-0 rounded-r-[4px] bg-viz-series-1 transition-[width] duration-300"
                  style={{ width: pct(c.spentMinor) }}
                />
                {c.previousSpentMinor > 0 && (
                  <span
                    className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-viz-reference ring-2 ring-card"
                    style={{ left: pct(c.previousSpentMinor) }}
                  />
                )}
              </span>

              <span className="text-right text-sm font-medium tabular-nums">
                {formatMoney(c.spentMinor, currency)}
              </span>
              <span className="sr-only">
                {t("finance.spending.screenReaderRow", {
                  month: monthName(previous),
                  amount: formatMoney(c.previousSpentMinor, currency),
                  count: c.transactionCount,
                })}
              </span>
            </RowLink>

            {hovered === i && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-full left-1/3 z-10 mt-1 w-56 rounded-lg border bg-card p-3 text-card-foreground text-xs shadow-md"
              >
                <p className="mb-1.5 font-medium text-foreground">
                  {c.category?.icon} {categoryName(c.category)}
                </p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
                  <dt>{monthName(month)}</dt>
                  <dd className="text-right text-foreground tabular-nums">
                    {formatMoney(c.spentMinor, currency)}
                  </dd>
                  <dt>{monthName(previous)}</dt>
                  <dd className="text-right text-foreground tabular-nums">
                    {formatMoney(c.previousSpentMinor, currency)}
                  </dd>
                  <dt>{t("finance.spending.change")}</dt>
                  <dd
                    className={cn(
                      "text-right text-foreground tabular-nums",
                      moneyToneClass(-change),
                    )}
                  >
                    {change >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(change), currency)}
                  </dd>
                  <dt>{t("finance.spending.share")}</dt>
                  <dd className="text-right text-foreground tabular-nums">{share}%</dd>
                  <dt>{t("finance.spending.transactions")}</dt>
                  <dd className="text-right text-foreground tabular-nums">{c.transactionCount}</dd>
                </dl>
                {c.spentMinor < 0 && (
                  <p className="mt-1.5 text-muted-foreground">{t("finance.spending.refundsWon")}</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The same numbers as a table: for screen readers, copying, and exact comparison. */
function SpendTable({ report, currency, month, previous }: ChartProps) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">{t("finance.transactions.category")}</th>
            <th className="px-3 py-2 text-right font-medium">{monthName(month)}</th>
            <th className="px-3 py-2 text-right font-medium">{monthName(previous)}</th>
            <th className="px-3 py-2 text-right font-medium">{t("finance.spending.change")}</th>
            <th className="py-2 pl-3 text-right font-medium">
              {t("finance.spending.transactions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {report.categories.map((c) => {
            const change = c.spentMinor - c.previousSpentMinor;
            return (
              <tr key={c.category?.id ?? "uncategorised"}>
                <td className="py-2 pr-3">
                  <RowLink c={c} month={month} className="hover:underline">
                    {c.category?.icon} {categoryName(c.category)}
                  </RowLink>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(c.spentMinor, currency)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                  {formatMoney(c.previousSpentMinor, currency)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", moneyToneClass(-change))}>
                  {change >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(change), currency)}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums">{c.transactionCount}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t font-medium">
          <tr>
            <td className="py-2 pr-3">{t("finance.spending.total")}</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatMoney(report.spentMinor, currency)}
            </td>
            <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
              {formatMoney(report.previousSpentMinor, currency)}
            </td>
            <td
              className={cn(
                "px-3 py-2 text-right tabular-nums",
                moneyToneClass(report.previousSpentMinor - report.spentMinor),
              )}
            >
              {report.spentMinor - report.previousSpentMinor >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(report.spentMinor - report.previousSpentMinor), currency)}
            </td>
            <td className="py-2 pl-3 text-right tabular-nums">
              {report.categories.reduce((n, c) => n + c.transactionCount, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Spending in currencies with no exchange rate yet is left out of the totals: say so. */
export function UnconvertedNote({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  if (codes.length === 0) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {t("finance.currencies.notConverted", { codes: codes.join(", ") })}
    </p>
  );
}
