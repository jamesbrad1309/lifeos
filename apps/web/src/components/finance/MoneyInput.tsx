import type * as React from "react";
import { Input } from "#components/ui/input";
import { currencySymbol } from "#lib/money";
import { cn } from "#lib/utils";

interface Props extends Omit<React.ComponentProps<"input">, "type" | "inputMode"> {
  currency?: string;
}

/**
 * A plain-text amount field with the currency symbol in front. People type
 * "12.50", never a minus sign: parse it with `parseMoneyInput` and apply the
 * sign from context (owed, expense).
 */
export function MoneyInput({ currency = "GBP", className, ...props }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        {currencySymbol(currency)}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
