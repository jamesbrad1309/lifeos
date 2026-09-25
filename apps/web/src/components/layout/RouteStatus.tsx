import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";

/** Shown in the content area while a slow route loader is still running. */
export function RoutePending() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {t("shell.route.loading")}
    </div>
  );
}

/** A route's loader or component threw: keep the shell, offer a retry. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="font-medium text-destructive">{t("shell.route.error")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          reset();
          router.invalidate();
        }}
      >
        {t("shell.route.tryAgain")}
      </Button>
    </div>
  );
}

export function RouteNotFound() {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{t("shell.route.notFound")}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to="/">{t("shell.route.goHome")}</Link>
      </Button>
    </div>
  );
}
