# App Shell: Sidebar, App Bar, Views

`apps/web` is laid out as a full-viewport dashboard
(`src/components/layout/AppShell.tsx`):

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ App bar: ☰/collapse · title · date · theme   │
│          ├──────────────────────────────────────────────┤
│ Habits   │                                              │
│ Mind     │ Page content: fills the full width,          │
│ Soon     │ scrolls independently of the chrome          │
│          │                                              │
│ Level/XP │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** (`Sidebar.tsx`): nav groups from `lib/navigation.ts`, planned
  modules greyed out as "Coming soon", and a level/XP card at the bottom.
  On desktop it collapses to a 64 px icon rail (remembered). Below the `lg`
  breakpoint it's a slide-in drawer (Radix Dialog) opened from ☰, which
  closes when a link is followed.
- **App bar**: the current view's title and subtitle, today's date, and a
  light/dark toggle. The theme toggles the `.dark` class from `index.css`,
  starting from the OS setting (`hooks/useTheme.ts`).
- **Content**: `<main>` is the scroll container, so page-level side rails
  can use `position: sticky`.

## Views and routing

There's no router library. The open view lives in the URL hash
(`#/dashboard`, `#/today`, `#/journal`) via `hooks/useHashView.ts`, so
refresh, the back button and shared links land on the same page. Sidebar
entries are plain `<a href="#/…">` links.

To add a page:

1. Add an item to `NAV_GROUPS` in `lib/navigation.ts` (id, label, icon,
   title, subtitle).
2. Render it for that id in `App.tsx`.

## Page layouts

Pages use every column of space the screen offers:

| View | Layout |
| ---- | ------ |
| Dashboard (`HabitsDashboard.tsx`) | KPI tiles (`StatTiles.tsx`), then habit cards in 1 → 5 columns (`sm` … `2xl`) |
| Today (`DayCalendar.tsx`) | Schedule timeline, plus a side column with today's progress and the checkable "anytime" habits |
| Journal (`journal/JournalView.tsx`) | Week strip, composer and timeline, plus a sticky side rail with counts, mood mix, filters and shortcuts. See [journal.md](../domain/journal.md) |

Side columns use `lg:grid-cols-[minmax(0,1fr)_20rem]`, widening to `24rem`
at `2xl`, and stack above or below the main column on phones.

## UI preferences

Sidebar collapse and theme are stored in `localStorage` through
`hooks/useStoredState.ts`, which falls back to plain state when storage is
unavailable (private windows, blocked site data). Only UI preferences go
there. Data always comes from the API.
