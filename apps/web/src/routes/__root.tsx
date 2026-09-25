import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "#components/layout/AppShell";
import { RouteNotFound } from "#components/layout/RouteStatus";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: RouteNotFound,
  staticData: { page: "notFound" },
});

function RootLayout() {
  const { i18n } = useTranslation();
  // Keyed by language: switching re-renders everything, including numbers
  // and dates formatted outside `t()` (lib/money.ts, lib/dates.ts).
  return (
    <AppShell key={i18n.language}>
      <Outlet />
    </AppShell>
  );
}
