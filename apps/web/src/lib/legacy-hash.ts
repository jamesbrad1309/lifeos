/** Where each old hash-routed view (`#/journal`) lives now. */
const LEGACY_VIEWS: Record<string, string> = {
  dashboard: "/habits",
  today: "/habits/today",
  journal: "/journal",
};

/**
 * Before the router, views lived in the URL hash. Rewrite those bookmarks to
 * the real path in place, before the router reads the location.
 */
export function redirectLegacyHash(): void {
  const view = window.location.hash.match(/^#\/?([a-z]+)$/)?.[1];
  const path = view && LEGACY_VIEWS[view];
  if (path) window.history.replaceState(null, "", path);
}
