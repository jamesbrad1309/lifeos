# App Shell: Sidebar, App Bar, Routes

`apps/web` is laid out as a full-viewport dashboard
(`src/components/layout/AppShell.tsx`):

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ App bar: ☰/collapse · title · date · theme   │
│          ├──────────────────────────────────────────────┤
│ Habits   │                                              │
│ Mind     │ Page content: fills the full width,          │
│ Money    │ scrolls independently of the chrome          │
│ Soon     │                                              │
│          │                                              │
│ Level/XP │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** (`Sidebar.tsx`): typed `<Link>`s grouped by `lib/navigation.ts`, planned
  screens greyed out as "Coming soon", and a level/XP card at the bottom.
  On desktop it collapses to a 64 px icon rail (remembered). Below the `lg`
  breakpoint it's a slide-in drawer (Radix Dialog) opened from ☰, which
  closes when a link is followed.
- **App bar**: the current route's title and subtitle, today's date, the
  EN | VI language switch ([i18n.md](i18n.md)), and a light/dark toggle. The theme toggles the `.dark` class from `index.css`,
  starting from the OS setting (`hooks/useTheme.ts`).
- **Content**: `<main>` is the scroll container, so page-level side rails
  can use `position: sticky`. It has extra bottom padding so the floating
  ➕ never covers the last row.
- **Quick log and toasts**: the shell mounts the floating ➕
  (`QuickLogButton`, also `n`), the quick-log sheet (opened from anywhere
  with `openQuickLog()` from `hooks/useQuickLog.ts`) and the `Toaster` for
  `lib/toast.ts`, so an "Undo" toast outlives the sheet that raised it.

## Routing

Pages are routes in [TanStack Router](https://tanstack.com/router), with
file-based routing: each file in `src/routes/` is a URL, and the Vite
plugin generates `src/routeTree.gen.ts` from them (committed, so `tsc`
works on a fresh clone; never edit it by hand).

| URL | File | Page |
| --- | ---- | ---- |
| `/` | `routes/index.tsx` | Redirects to `/habits` |
| `/habits` | `routes/habits/index.tsx` | Habits dashboard |
| `/habits/today` | `routes/habits/today.tsx` | Today's schedule |
| `/journal?date=YYYY-MM-DD` | `routes/journal.tsx` | Journal. No `date` means today |
| `/finance` | `routes/finance/index.tsx` | Redirects to `/finance/accounts` |
| `/finance/accounts` | `routes/finance/accounts.tsx` | Money setup ([account-setup.md](../finance/account-setup.md)) |
| `/finance/transactions?view=review&month=&account=&category=&q=` | `routes/finance/transactions.tsx` | Transactions and the "To review" inbox. The default `view=all` is stripped from the URL |
| `/finance/currencies` | `routes/finance/currencies.tsx` | Currencies in use, main currency, exchange rates ([money-handling.md](../finance/money-handling.md#currencies)) |
| `/finance/budgets?month=` | `routes/finance/budgets.tsx` | Budget vs actual with pace ([budgets-and-reports.md](../finance/budgets-and-reports.md)) |
| `/finance/spending?month=&account=` | `routes/finance/spending.tsx` | Spend by category for a month vs the one before ([budgets-and-reports.md](../finance/budgets-and-reports.md)) |
| `/log?amount=3.40&category=coffee` | `routes/log.tsx` | Opens the quick-log sheet over the dashboard, filled in (a deep link for phone shortcuts) |
| anything else | `routes/__root.tsx` | "Not found", inside the shell |

- **Root route** (`__root.tsx`) renders `AppShell` around an `<Outlet />`,
  so the sidebar and app bar never remount between pages.
- **Titles live on routes.** Each route sets `staticData: { page: "journal" }`;
  the app bar and the browser tab title use the deepest matched route that
  has one, translated from `shell.pages.<page>` ([i18n.md](i18n.md)). The
  field is typed in `src/router.ts`.
- **Links are typed.** Sidebar entries (`lib/navigation.ts`) and `<Link>`s
  use real route paths, so a renamed route is a compile error. Active
  styling comes from the router (`data-status="active"`); section index
  pages set `exact` so `/habits` isn't highlighted on `/habits/today`.
- **Search params are validated** with zod (`validateSearch`). A malformed
  value such as `?date=2026-02-30` falls back to the default; it doesn't
  throw.
- **Loaders warm Apollo's cache.** A route's `loader` runs its page's
  queries through `context.apolloClient` (same query, same variables), and
  the components keep plain `useQuery`, which then reads from the cache.
  Links preload on hover or focus (`defaultPreload: "intent"`). Apollo owns
  caching, so the router's own loader cache is off
  (`defaultPreloadStaleTime: 0`).
- **Pending and error UI** come from the router defaults in
  `components/layout/RouteStatus.tsx`: a spinner if a loader takes over
  a second, and an error card with "Try again" inside the shell.
- **Code-splitting** is automatic (`autoCodeSplitting`): each page's
  component ships in its own chunk. The shell is in the main bundle.
- **Scroll**: pages scroll inside `<main id="main">`, so the router is told
  to reset that element on navigation and to restore it on back/forward.
- **Search params are JSON-parsed by the router**, so `?amount=3.40`
  arrives as the number `3.4`. Schemas for free-text or numeric-looking
  values use `z.coerce.string()`.
- **Old hash URLs** (`#/journal`) are rewritten to the path on startup
  (`lib/legacy-hash.ts`).

In Docker, `docker/web.nginx.conf` already serves `index.html` for any
unknown path, so deep links survive a refresh. Vite's dev server does the
same.

To add a page:

1. Create a file in `src/routes/` with `createFileRoute`, a `staticData`
   title and subtitle, a `loader` that prefetches its queries, and the
   component. The dev server regenerates the route tree on save.
2. Add a sidebar entry to `NAV_GROUPS` in `lib/navigation.ts`.

## Page layouts

Pages use every column of space the screen offers:

| Page | Layout |
| ---- | ------ |
| Dashboard (`HabitsDashboard.tsx`) | KPI tiles (`StatTiles.tsx`), then habit cards in 1 → 5 columns (`sm` … `2xl`) |
| Today (`DayCalendar.tsx`) | Schedule timeline, plus a side column with today's progress and the checkable "anytime" habits |
| Transactions (`finance/transactions/TransactionsView.tsx`) | All / To review tabs, month stepper, search and filters, then the transactions grouped by day with each day's spend. In "To review", each row has a category picker, and focus moves to the next one after filing |
| Accounts (`finance/setup/MoneySetup.tsx`) | Accounts grouped by type, plus a sticky side rail with net worth, what's coming up, and archived accounts |
| Journal (`journal/JournalView.tsx`) | Week strip, composer and timeline, plus a sticky side rail with counts, mood mix, filters and shortcuts. See [journal.md](../domain/journal.md) |

Side columns use `lg:grid-cols-[minmax(0,1fr)_20rem]`, widening to `24rem`
at `2xl`, and stack above or below the main column on phones.

## UI preferences

Sidebar collapse and theme are stored in `localStorage` through
`hooks/useStoredState.ts`, which falls back to plain state when storage is
unavailable (private windows, blocked site data). Only UI preferences go
there. Data always comes from the API.
