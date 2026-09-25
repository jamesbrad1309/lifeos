import type { ApolloClient } from "@apollo/client";
import { createRouter } from "@tanstack/react-router";
import { RouteError, RoutePending } from "#components/layout/RouteStatus";
import type { shell } from "#i18n/en/shell";
import { apolloClient } from "#lib/apollo-client";
import { routeTree } from "./routeTree.gen";

/** Handed to every route's `beforeLoad` and `loader`. */
export interface RouterContext {
  apolloClient: ApolloClient;
}

export const router = createRouter({
  routeTree,
  context: { apolloClient },
  // Hovering or focusing a link runs the target route's loader, so its
  // queries are usually in Apollo's cache by the time the click lands.
  defaultPreload: "intent",
  // Apollo owns caching and invalidation (refetchQueries after mutations);
  // the router shouldn't keep its own copy of loader results on top.
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  // Pages scroll inside the shell's <main id="main">, not the window: new
  // pages start at its top, back/forward restores where you were.
  scrollRestoration: true,
  scrollToTopSelectors: ["#main"],
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }

  /**
   * Per-route metadata, read by the app shell: which `shell.pages` entry
   * gives the app bar's (translated) title and subtitle and the tab title.
   */
  interface StaticDataRouteOption {
    page?: keyof typeof shell.pages;
  }
}
