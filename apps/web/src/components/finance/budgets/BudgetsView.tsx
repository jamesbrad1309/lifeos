import { useQuery } from "@apollo/client/react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  OctagonAlert,
  Plus,
  Repeat,
} from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MONEY_OUT_CLASS } from "#components/finance/Amount";
import { BudgetDialog } from "#components/finance/budgets/BudgetDialog";
import { UnconvertedNote } from "#components/finance/reports/SpendingView";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { BUDGET_QUERY, CATEGORIES_QUERY } from "#graphql/finance";
import type { BudgetLine, BudgetPace, BudgetReport, Category } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { addMonths, currentMonth, formatMonth, todayIsoDate } from "#lib/dates";
import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

interface Props {
  month?: string;
  onMonthChange: (month: string) => void;
}

/** Status is never colour alone: each pace has an icon and a label (`finance.budgets.pace`) too. */
const PACE: Record<BudgetPace, { icon: typeof CircleCheck; bar: string; text: string }> = {
  ON_TRACK: {
    icon: CircleCheck,
    bar: "bg-status-good",
    text: "text-status-good",
  },
  CLOSE: {
    icon: CircleAlert,
    bar: "bg-status-warning",
    text: "text-amber-700 dark:text-status-warning",
  },
  OVER: {
    icon: OctagonAlert,
    bar: "bg-status-critical",
    text: "text-status-critical",
  },
};

type DialogState =
  | { kind: "edit"; line: BudgetLine }
  | { kind: "new"; category?: Category; averageSpentMinor?: number }
  | null;

/**
 * Budget vs actual for a month. Limits carry forward until changed; "spent"
 * comes from the monthly_totals aggregate; pace compares spending with how
 * much of the month has gone.
 */
export function BudgetsView({ month: requested, onMonthChange }: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const month = requested ?? currentMonth();
  const { data, error } = useQuery<{ budget: BudgetReport }>(BUDGET_QUERY, {
    variables: { month, today: todayIsoDate() },
  });
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [lastDialog, setLastDialog] = useState<DialogState>(null);
  const open = (next: DialogState) => {
    setLastDialog(next);
    setDialog(next);
  };

  const report = data?.budget;
  const budgeted = new Set(report?.lines.map((l) => l.category.id));
  const choices = (categoriesData?.categories ?? []).filter(
    (c) => c.kind === "expense" && !budgeted.has(c.id),
  );
  const isPast = month < currentMonth();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.previousMonth")}
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-24 text-center text-sm font-medium">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.nextMonth")}
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          size="sm"
          className="ml-auto"
          disabled={choices.length === 0}
          onClick={() => open({ kind: "new" })}
        >
          <Plus className="size-4" /> {t("finance.budgets.addBudget")}
        </Button>
      </div>

      {error && <p className="text-destructive">{error.message}</p>}

      {report && report.lines.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {t("finance.budgets.noneTitle", { month: formatMonth(month) })}
          </p>
          <p className="mt-1">{t("finance.budgets.noneBody")}</p>
        </div>
      )}

      {report && report.lines.length > 0 && (
        <>
          <Summary report={report} isPast={isPast} />
          <UnconvertedNote codes={report.unconverted} />
          <Card>
            <ul className="divide-y">
              {report.lines.map((line) => (
                <BudgetRow
                  key={line.category.id}
                  line={line}
                  monthProgress={report.monthProgress}
                  currency={report.currency}
                  onEdit={() => open({ kind: "edit", line })}
                />
              ))}
            </ul>
          </Card>
        </>
      )}

      {report && report.unbudgeted.length > 0 && (
        <section aria-labelledby="unbudgeted" className="flex flex-col gap-2">
          <h2
            id="unbudgeted"
            className="px-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("finance.budgets.withoutBudget")}
          </h2>
          <Card>
            <ul className="divide-y">
              {report.unbudgeted.map((u) => (
                <li
                  key={u.category?.id ?? "uncategorised"}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span aria-hidden className="w-5 text-center">
                    {u.category?.icon ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{categoryName(u.category)}</span>
                  <span className="tabular-nums">{formatMoney(u.spentMinor, report.currency)}</span>
                  {u.category ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        open({
                          kind: "new",
                          category: u.category ?? undefined,
                          averageSpentMinor: u.averageSpentMinor,
                        })
                      }
                    >
                      {t("finance.budgets.setBudget")}
                    </Button>
                  ) : (
                    <span className="w-[5.5rem]" />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {lastDialog && (
        <BudgetDialog
          key={
            lastDialog.kind === "edit"
              ? lastDialog.line.category.id
              : `new-${lastDialog.category?.id ?? ""}`
          }
          open={dialog !== null}
          onOpenChange={(o) => !o && setDialog(null)}
          month={month}
          currency={report?.currency ?? "GBP"}
          line={lastDialog.kind === "edit" ? lastDialog.line : undefined}
          category={lastDialog.kind === "new" ? lastDialog.category : undefined}
          choices={choices}
          averageSpentMinor={
            lastDialog.kind === "edit"
              ? lastDialog.line.averageSpentMinor
              : lastDialog.averageSpentMinor
          }
        />
      )}
    </div>
  );
}

function Summary({ report, isPast }: { report: BudgetReport; isPast: boolean }) {
  const { t } = useTranslation();
  const { availableMinor, spentMinor, remainingMinor } = report.totals;
  const counts = { ON_TRACK: 0, CLOSE: 0, OVER: 0 };
  for (const line of report.lines) counts[line.pace]++;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <p className="text-sm text-muted-foreground">
          {remainingMinor >= 0 ? t("finance.budgets.leftToSpend") : t("finance.budgets.overBy")}
        </p>
        <p
          className={cn(
            "text-5xl font-semibold tracking-tight",
            remainingMinor < 0 && MONEY_OUT_CLASS,
          )}
        >
          {formatMoney(Math.abs(remainingMinor), report.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {t("finance.budgets.spentOf", {
            spent: formatMoney(spentMinor, report.currency),
            available: formatMoney(availableMinor, report.currency),
          })}
          {!isPast &&
            ` · ${t("common.percentOfMonthGone", { percent: Math.round(report.monthProgress * 100) })}`}
        </p>
      </div>
      <ul className="flex gap-4 pb-1.5 text-sm">
        {(Object.keys(PACE) as BudgetPace[])
          .filter((p) => counts[p] > 0)
          .map((p) => {
            const { icon: Icon, text } = PACE[p];
            return (
              <li key={p} className="flex items-center gap-1.5">
                <Icon className={cn("size-4", text)} aria-hidden />
                <span className="font-medium tabular-nums">{counts[p]}</span>
                <span className="text-muted-foreground">{t(`finance.budgets.paceCount.${p}`)}</span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/**
 * One budget: a bar of spend against what's available, in the pace's status
 * colour, with a tick where "on pace" would be today.
 */
function BudgetRow({
  line,
  monthProgress,
  currency,
  onEdit,
}: { line: BudgetLine; monthProgress: number; currency: string; onEdit: () => void }) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const status = PACE[line.pace];
  const used = line.availableMinor > 0 ? line.spentMinor / line.availableMinor : 0;
  const showPaceTick = monthProgress > 0 && monthProgress < 1;

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="w-5 text-center">
            {line.category.icon}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {categoryName(line.category)}
          </span>
          <span className={cn("flex items-center gap-1 text-xs font-medium", status.text)}>
            <status.icon className="size-3.5" aria-hidden />
            {t(`finance.budgets.pace.${line.pace}`)}
          </span>
        </div>

        <div className="relative ml-8 h-2 rounded-full bg-muted">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
              status.bar,
            )}
            style={{ width: `${Math.min(100, Math.max(0, used) * 100)}%` }}
          />
          {showPaceTick && (
            <div
              aria-hidden
              title={t("finance.budgets.onPaceToday")}
              className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-viz-reference ring-2 ring-card"
              style={{ left: `${monthProgress * 100}%` }}
            />
          )}
        </div>

        <div className="ml-8 flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground">
          <span className="tabular-nums">
            <Trans
              i18nKey="finance.budgets.of"
              values={{
                spent: formatMoney(line.spentMinor, currency),
                available: formatMoney(line.availableMinor, currency),
              }}
              components={{ b: <span className="font-medium text-foreground" /> }}
            />
            {line.carriedMinor > 0 &&
              t("finance.budgets.rolledIn", { amount: formatMoney(line.carriedMinor, currency) })}
          </span>
          <span className="flex items-center gap-2 tabular-nums">
            {line.rollover && (
              <Repeat className="size-3" aria-label={t("finance.budgets.rollsOver")} />
            )}
            {line.remainingMinor >= 0 ? (
              t("finance.budgets.left", { amount: formatMoney(line.remainingMinor, currency) })
            ) : (
              <span className={cn("font-medium", MONEY_OUT_CLASS)}>
                {t("finance.budgets.over", { amount: formatMoney(-line.remainingMinor, currency) })}
              </span>
            )}
          </span>
        </div>
      </button>
    </li>
  );
}
