import { useMutation } from "@apollo/client/react";
import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
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
import { REMOVE_BUDGET_MUTATION, SET_BUDGET_MUTATION } from "#graphql/finance";
import type { BudgetLine, Category } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { formatMonth } from "#lib/dates";
import { formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM the change applies from. */
  month: string;
  /** The main currency: limits are typed in it. */
  currency: string;
  /** Edit this budget. */
  line?: BudgetLine;
  /** Or start one: a fixed category, or a choice among these. */
  category?: Category;
  choices?: Category[];
  /** "You usually spend…", and the suggested starting amount. */
  averageSpentMinor?: number;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Rounds a suggestion up to a tidy amount in any currency: to half of its
 * leading power of ten. £37.20 → £40, £246 → £250, ₫603,060 → ₫650,000.
 */
function suggest(averageMinor: number, currency: string): string {
  if (averageMinor <= 0) return "";
  const step = 10 ** Math.floor(Math.log10(averageMinor)) / 2;
  return toMoneyInput(Math.ceil(averageMinor / step) * step, currency);
}

export function BudgetDialog({
  open,
  currency,
  onOpenChange,
  month,
  line,
  category,
  choices = [],
  averageSpentMinor,
}: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const initial = () => ({
    categoryId: line?.category.id ?? category?.id ?? "",
    amount: line
      ? toMoneyInput(line.limitMinor, currency)
      : suggest(averageSpentMinor ?? 0, currency),
    rollover: line?.rollover ?? false,
  });
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(initial());
      setError(null);
    }
  }

  const options = { refetchQueries: ["Budget"], awaitRefetchQueries: true };
  const [setBudget, setting] = useMutation(SET_BUDGET_MUTATION, options);
  const [removeBudget, removing] = useMutation(REMOVE_BUDGET_MUTATION, options);
  const shown = line?.category ?? category;
  const name = shown ? categoryName(shown) : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoneyInput(draft.amount, currency);
    if (!draft.categoryId) return setError(t("finance.budgets.dialog.chooseCategory"));
    if (!amountMinor) return setError(t("finance.budgets.dialog.enterLimit"));
    try {
      await setBudget({
        variables: {
          input: { categoryId: draft.categoryId, month, amountMinor, rollover: draft.rollover },
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  async function handleRemove() {
    if (!line) return;
    try {
      await removeBudget({ variables: { categoryId: line.category.id, month } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("finance.budgets.dialog.couldntRemove"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {name
                ? `${shown?.icon ?? ""} ${t("finance.budgets.dialog.titleFor", { name })}`.trim()
                : t("finance.budgets.dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("finance.budgets.dialog.appliesFrom", { month: formatMonth(month) })}
            </DialogDescription>
          </DialogHeader>

          {!line && !category && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget-category">{t("finance.budgets.dialog.category")}</Label>
              <select
                id="budget-category"
                className={selectClass}
                value={draft.categoryId}
                onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
              >
                <option value="" disabled>
                  {t("common.choose")}
                </option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {categoryName(c)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">{t("finance.budgets.dialog.limit")}</Label>
            <MoneyInput
              id="budget-amount"
              currency={currency}
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            />
            {averageSpentMinor != null && averageSpentMinor > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("finance.budgets.dialog.average", {
                  amount: formatMoney(averageSpentMinor, currency),
                })}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.rollover}
              onChange={(e) => setDraft((d) => ({ ...d, rollover: e.target.checked }))}
              className="mt-0.5 accent-primary"
            />
            <span>
              {t("finance.budgets.dialog.rollover")}
              <span className="block text-xs text-muted-foreground">
                {t("finance.budgets.dialog.rolloverHint")}
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className={line ? "sm:justify-between" : undefined}>
            {line && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                disabled={removing.loading}
                onClick={handleRemove}
              >
                <Trash2 className="size-4" />{" "}
                {t("finance.budgets.dialog.stopFrom", { month: formatMonth(month) })}
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={setting.loading}>
                {t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
