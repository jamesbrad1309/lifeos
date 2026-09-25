import { useMutation } from "@apollo/client/react";
import type { TFunction } from "i18next";
import { Archive, ArrowLeft } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_REFETCH,
  ARCHIVE_ACCOUNT_MUTATION,
  CREATE_ACCOUNT_MUTATION,
  UPDATE_ACCOUNT_MUTATION,
} from "#graphql/finance";
import type { Account, AccountType } from "#graphql/types";
import { useCurrencies } from "#hooks/useCurrencies";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER } from "#lib/account-types";
import { todayIsoDate } from "#lib/dates";
import {
  currencyName,
  moneyPlaceholder,
  parseMoneyInput,
  parsePercentToBps,
  toMoneyInput,
  toPercentInput,
} from "#lib/money";
import { cn } from "#lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this account. Without one, the dialog adds a new account. */
  account?: Account;
  /** Skip the type picker when adding (e.g. from an empty group's shortcut). */
  initialType?: AccountType;
}

interface Draft {
  /** ISO 4217; chosen when adding, fixed after. */
  currency: string;
  type: AccountType | null;
  name: string;
  institution: string;
  last4: string;
  balance: string;
  owedByMe: boolean;
  creditLimit: string;
  statementDay: string;
  paymentDueDay: string;
  minPayment: string;
  apr: string;
  monthlyPayment: string;
  loanStartDate: string;
  termMonths: string;
  dueDate: string;
}

function draftFor(
  account: Account | undefined,
  initialType: AccountType | undefined,
  mainCurrency: string,
): Draft {
  const currency = account?.currency ?? mainCurrency;
  return {
    currency,
    type: account?.type ?? initialType ?? null,
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    last4: account?.last4 ?? "",
    balance: "",
    owedByMe: true,
    creditLimit: toMoneyInput(account?.creditLimitMinor, currency),
    statementDay: account?.statementDay?.toString() ?? "",
    paymentDueDay: account?.paymentDueDay?.toString() ?? "",
    minPayment: toMoneyInput(account?.minPaymentMinor, currency),
    apr: toPercentInput(account?.aprBps),
    monthlyPayment: toMoneyInput(account?.monthlyPaymentMinor, currency),
    loanStartDate: account?.loanStartDate ?? "",
    termMonths: account?.termMonths?.toString() ?? "",
    dueDate: account?.dueDate ?? "",
  };
}

/** Blank → null; otherwise the parsed value, or an error message for the form. */
function optional<T>(raw: string, parse: (s: string) => T | null, error: string): T | null {
  if (raw.trim() === "") return null;
  const value = parse(raw);
  if (value === null) throw new Error(error);
  return value;
}

function parseDay(raw: string): number | null {
  const day = Number(raw);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/**
 * The input for createAccount/updateAccount: only the chosen type's fields,
 * the way the API's per-type schema expects them. Throws with a message
 * for the first thing that's wrong.
 */
function toInput(t: TFunction, draft: Draft, type: AccountType, creating: boolean) {
  const config = ACCOUNT_TYPES[type];
  const words = t(`finance.accountTypes.${type}`, { returnObjects: true });
  const name = draft.name.trim();
  if (!name) throw new Error(t("finance.form.errors.required", { field: words.name }));

  const input: Record<string, unknown> = {
    type,
    name,
    institution: config.hasInstitution ? draft.institution.trim() || null : null,
    last4: config.hasLast4 ? draft.last4.trim() || null : null,
  };
  if (input.last4 && !/^\d{4}$/.test(input.last4 as string)) {
    throw new Error(t("finance.form.errors.last4"));
  }

  if (creating) {
    const balance = parseMoneyInput(draft.balance, draft.currency);
    if (balance === null)
      throw new Error(t("finance.form.errors.balance", { field: words.balance }));
    input.currentBalanceMinor = balance;
    input.openingBalanceDate = todayIsoDate();
    input.currency = draft.currency;
    if (type === "IOU") input.owedByMe = draft.owedByMe;
  }

  if (type === "CREDIT_CARD") {
    const limit = parseMoneyInput(draft.creditLimit, draft.currency);
    if (!limit) throw new Error(t("finance.form.errors.creditLimit"));
    input.creditLimitMinor = limit;
    input.statementDay = optional(
      draft.statementDay,
      parseDay,
      t("finance.form.errors.statementDay"),
    );
    input.paymentDueDay = optional(draft.paymentDueDay, parseDay, t("finance.form.errors.dueDay"));
    input.minPaymentMinor = optional(
      draft.minPayment,
      (value) => parseMoneyInput(value, draft.currency),
      t("finance.form.errors.minPayment"),
    );
  }
  if (type === "CREDIT_CARD" || type === "LOAN") {
    input.aprBps = optional(draft.apr, parsePercentToBps, t("finance.form.errors.apr"));
  }
  if (type === "LOAN") {
    input.monthlyPaymentMinor = optional(
      draft.monthlyPayment,
      (value) => parseMoneyInput(value, draft.currency),
      t("finance.form.errors.monthlyPayment"),
    );
    input.loanStartDate = draft.loanStartDate || null;
    input.termMonths = optional(
      draft.termMonths,
      (s) => (/^\d+$/.test(s) && Number(s) > 0 ? Number(s) : null),
      t("finance.form.errors.term"),
    );
  }
  if (type === "IOU") input.dueDate = draft.dueDate || null;

  return input;
}

export function AccountForm({ open, onOpenChange, account, initialType }: Props) {
  const { t } = useTranslation();
  const { main, list: currencies } = useCurrencies();
  const creating = !account;
  const [draft, setDraft] = useState(() => draftFor(account, initialType, main));
  const [error, setError] = useState<string | null>(null);

  const [createAccount, created] = useMutation(CREATE_ACCOUNT_MUTATION, {
    refetchQueries: ACCOUNTS_REFETCH,
    awaitRefetchQueries: true,
  });
  const [updateAccount, updated] = useMutation(UPDATE_ACCOUNT_MUTATION, {
    refetchQueries: ACCOUNTS_REFETCH,
    awaitRefetchQueries: true,
  });
  const [archiveAccount, archived] = useMutation(ARCHIVE_ACCOUNT_MUTATION, {
    refetchQueries: ACCOUNTS_REFETCH,
    awaitRefetchQueries: true,
  });
  const saving = created.loading || updated.loading || archived.loading;

  // Start from the account's current values every time the dialog opens, so
  // a cancelled edit never leaves a stale draft behind.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(draftFor(account, initialType, main));
      setError(null);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.type) return;
    try {
      const input = toInput(t, draft, draft.type, creating);
      if (account) await updateAccount({ variables: { id: account.id, input } });
      else await createAccount({ variables: { input } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  async function handleArchive() {
    if (!account) return;
    try {
      await archiveAccount({ variables: { id: account.id } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("finance.form.errors.archive"));
    }
  }

  const type = draft.type;
  const config = type ? ACCOUNT_TYPES[type] : null;
  const words = type ? t(`finance.accountTypes.${type}`, { returnObjects: true }) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {!type || !config || !words ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("finance.form.whatAreYouAdding")}</DialogTitle>
              <DialogDescription>{t("finance.form.startFromToday")}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ACCOUNT_TYPE_ORDER.map((option) => {
                const Icon = ACCOUNT_TYPES[option].icon;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => set("type", option)}
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {t(`finance.accountTypes.${option}.label`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`finance.accountTypes.${option}.hint`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {creating && !initialType && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-ml-2 size-7"
                    aria-label={t("finance.form.chooseDifferentType")}
                    onClick={() => set("type", null)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                )}
                <config.icon className="size-4 text-muted-foreground" />
                {creating
                  ? t("finance.form.addTitle", { type: words.label.toLocaleLowerCase() })
                  : t("finance.form.editTitle", { name: account?.name })}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={words.name} id="account-name" wide={!config.hasInstitution}>
                <Input
                  id="account-name"
                  autoFocus
                  placeholder={words.namePlaceholder}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              {config.hasInstitution && (
                <Field label={words.institution} id="account-institution" optional>
                  <Input
                    id="account-institution"
                    value={draft.institution}
                    onChange={(e) => set("institution", e.target.value)}
                  />
                </Field>
              )}

              {creating && (
                <Field label={words.balance} id="account-balance" wide={!config.hasLast4}>
                  <MoneyInput
                    currency={draft.currency}
                    id="account-balance"
                    placeholder={moneyPlaceholder(draft.currency)}
                    value={draft.balance}
                    onChange={(e) => set("balance", e.target.value)}
                  />
                </Field>
              )}
              {creating && currencies.length > 1 && (
                <Field label={t("finance.currencies.accountCurrency")} id="account-currency" wide>
                  <select
                    id="account-currency"
                    value={draft.currency}
                    onChange={(e) => set("currency", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {currencyName(c.code)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {config.hasLast4 && (
                <Field label={t("finance.form.last4")} id="account-last4" optional wide={!creating}>
                  <Input
                    id="account-last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4821"
                    value={draft.last4}
                    onChange={(e) => set("last4", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              )}

              {type === "IOU" && creating && (
                <fieldset className="flex flex-col gap-2 sm:col-span-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t("finance.form.whoOwesWhom")}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        owedByMe: true,
                        label: draft.name.trim()
                          ? t("finance.form.iOweName", { name: draft.name.trim() })
                          : t("finance.form.iOweThem"),
                      },
                      {
                        owedByMe: false,
                        label: draft.name.trim()
                          ? t("finance.form.nameOwesMe", { name: draft.name.trim() })
                          : t("finance.form.theyOweMe"),
                      },
                    ].map((option) => (
                      <Button
                        key={option.label}
                        type="button"
                        variant={draft.owedByMe === option.owedByMe ? "default" : "outline"}
                        aria-pressed={draft.owedByMe === option.owedByMe}
                        onClick={() => set("owedByMe", option.owedByMe)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              )}

              {type === "CREDIT_CARD" && (
                <>
                  <Field label={t("finance.form.creditLimit")} id="account-limit">
                    <MoneyInput
                      currency={draft.currency}
                      id="account-limit"
                      placeholder="5000"
                      value={draft.creditLimit}
                      onChange={(e) => set("creditLimit", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.apr")} id="account-apr" optional>
                    <Input
                      id="account-apr"
                      inputMode="decimal"
                      placeholder="22.9"
                      value={draft.apr}
                      onChange={(e) => set("apr", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.statementDay")} id="account-statement" optional>
                    <Input
                      id="account-statement"
                      inputMode="numeric"
                      placeholder={t("finance.form.dayOfMonth", { day: 18 })}
                      value={draft.statementDay}
                      onChange={(e) => set("statementDay", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.paymentDueDay")} id="account-due" optional>
                    <Input
                      id="account-due"
                      inputMode="numeric"
                      placeholder={t("finance.form.dayOfMonth", { day: 8 })}
                      value={draft.paymentDueDay}
                      onChange={(e) => set("paymentDueDay", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.minimumPayment")} id="account-min" optional>
                    <MoneyInput
                      currency={draft.currency}
                      id="account-min"
                      value={draft.minPayment}
                      onChange={(e) => set("minPayment", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {type === "LOAN" && (
                <>
                  <Field label={t("finance.form.monthlyPayment")} id="account-monthly" optional>
                    <MoneyInput
                      currency={draft.currency}
                      id="account-monthly"
                      placeholder="310"
                      value={draft.monthlyPayment}
                      onChange={(e) => set("monthlyPayment", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.apr")} id="account-apr" optional>
                    <Input
                      id="account-apr"
                      inputMode="decimal"
                      placeholder="6.9"
                      value={draft.apr}
                      onChange={(e) => set("apr", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.startDate")} id="account-loan-start" optional>
                    <Input
                      id="account-loan-start"
                      type="date"
                      value={draft.loanStartDate}
                      onChange={(e) => set("loanStartDate", e.target.value)}
                    />
                  </Field>
                  <Field label={t("finance.form.termMonths")} id="account-term" optional>
                    <Input
                      id="account-term"
                      inputMode="numeric"
                      placeholder="48"
                      value={draft.termMonths}
                      onChange={(e) => set("termMonths", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {type === "IOU" && (
                <Field label={t("finance.form.dueDate")} id="account-due-date" optional>
                  <Input
                    id="account-due-date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)}
                  />
                </Field>
              )}
            </div>

            {!creating && (
              <p className="text-xs text-muted-foreground">
                <Trans i18nKey="finance.form.changeBalanceHint" components={{ b: <b /> }} />
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className={cn(!creating && "sm:justify-between")}>
              {!creating && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={saving}
                  onClick={handleArchive}
                >
                  <Archive className="size-4" /> {t("common.archive")}
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {creating ? t("finance.form.addAccount") : t("common.save")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  optional,
  wide,
  children,
}: {
  label: string;
  id: string;
  optional?: boolean;
  /** Span both columns. */
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col gap-2", wide && "sm:col-span-2")}>
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("common.optional")}</span>
        )}
      </Label>
      {children}
    </div>
  );
}
