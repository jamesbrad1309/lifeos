# Use Cases

What the habit tracker actually needs to do, driving the data model
([habit-data-model.md](habit-data-model.md)) and the GraphQL schema
([graphql-bff.md](../backend/graphql-bff.md)). Checkboxes track build status
as of this doc's last edit — re-verify against the code before trusting an
unchecked box is still accurate.

**Impact score** (1–5, how much the product suffers without it): `5` core
loop, unusable without it · `4` high-value, used daily · `3` meaningfully
improves UX · `2` edge case / power-user · `1` speculative.

## Habit management

- [x] **Create a custom habit** (name, icon/color, unit, target, schedule) — Impact 5
  → `Mutation.createHabit`
- [x] **Edit a habit's definition** (name/unit/target/schedule/start time) — Impact 4
  → `Mutation.updateHabit` + `EditHabitDialog`
- [x] **Configure a schedule preset** (daily / weekdays / weekends / custom days / N×week / every N days) — Impact 4
  → `ScheduleEditor`; presets are just `weekly` with specific `daysOfWeek`, no extra schema
- [x] **Set a start time** for the day-calendar view — Impact 3
  → `Habit.startTime` ("HH:mm")
- [x] **Archive a habit** (soft-delete, keeps history) — Impact 3
  → `Mutation.archiveHabit`
- [ ] **Unarchive / view archived habits** — Impact 2
  → Backend done (`unarchiveHabit`, `archivedHabits` query) — no frontend UI yet
- [x] **Pause a habit** (skip it without archiving) — Impact 3
  → `Mutation.pauseHabit`/`resumeHabit`; excluded from `todayHabits` and the day view while paused
- [ ] **Attach arbitrary custom fields to a habit** — Impact 1
  → Backend accepts `metadata` JSON on create — no UI to add/edit it

## Daily tracking

- [x] **See which habits are due today** — Impact 5
  → `Query.todayHabits`; day view applies the same `isDueOn` filter client-side
- [x] **Check a habit off for today** — Impact 5
  → `Mutation.upsertHabitEntry` (`completed: true`)
- [x] **Log a quantitative value for today** — Impact 4
  → `Mutation.upsertHabitEntry` (`value: 5`)
- [ ] **Add a note to today's entry** — Impact 2
  → Backend field exists (`note`) — no note input in either UI view
- [x] **Re-check/correct today's entry without duplicating** — Impact 3
  → Upsert on `(habitId, date)` by design

## Dashboard & gamification

- [x] **See aggregate level/XP/streak stats across all habits** — Impact 4
  → `Query.dashboardStats`, `DashboardHeader`
- [x] **See per-habit streak, points, and level** — Impact 4
  → `Habit.currentStreak`/`points`/`level`, shown as card badges
- [x] **See a GitHub-style contribution heatmap per habit** — Impact 3
  → `Habit.heatmap`, `HeatmapGrid` (120-day window)
- [ ] **See longest streak / total completions per habit** — Impact 2
  → Queried (`longestStreak`, `totalCompletions`) but not displayed in either view yet

## Calendar

- [x] **Day view: today's due habits on a time-of-day timeline** — Impact 4
  → `DayCalendar`, positions habits by `startTime`; untimed habits shown as an "Anytime" chip row
- [x] **Check a habit off directly from the day view** — Impact 4
  → Same `upsertHabitEntry` mutation as the dashboard card
- [ ] **Week or month calendar view** — Impact 2
  → Only a single day view exists so far

## History & review

- [ ] **View a single habit's full entry history** (list, not just heatmap) — Impact 2
  → `Query.habitEntries(habitId)` exists — no history list UI
- [ ] **Habit detail page** — Impact 1
  → `Query.habit(id)` exists — no dedicated route/page, everything lives on the dashboard card

## Motivation & rewards

Ideas that give the gamification layer more to do than a single points
number. None are built yet.

- [ ] **Streak freeze**: spend earned points to protect a streak on a missed day — Impact 3
  → A `StreakFreeze(habitId, date)` row; `streak.util.ts` treats a frozen day as "not due", like a paused habit
- [ ] **Achievements / badges** ("First 7-day streak", "100 check-ins", "Perfect week") — Impact 3
  → Derived from entries at query time, the same way points are; no stored "unlocked" flag is needed until unlocks need a timestamp
- [ ] **Milestone celebration** when a streak reaches 7 / 30 / 100 days — Impact 2
  → Frontend only: compare `currentStreak` before and after `upsertHabitEntry`
- [ ] **Weekly challenge**: a temporary target, e.g. "meditate 5× this week for 2× XP" — Impact 2
  → `Challenge` entity with a date range and a multiplier fed into `computePoints`
- [ ] **Reward shop**: trade points for self-defined rewards ("takeaway night = 500 pts") — Impact 2
  → Needs a spent-points ledger, because points are currently derived and can't be decreased

## Routines & structure

- [ ] **Habit stacking / routines**: group habits into an ordered "Morning routine" and check them off in sequence — Impact 3
  → `Routine` plus an ordered join table; the day view renders a routine as one block at its first habit's `startTime`
- [ ] **Negative habits** ("no sugar", "no doomscrolling"): success is the *absence* of an event — Impact 3
  → A `polarity: "avoid"` flag; a due day counts as successful unless an entry marks a slip
- [ ] **Habit templates**: start from a preset such as "Drink 2L water" or "Read 20 pages" — Impact 2
  → A static list on the frontend that pre-fills `CreateHabitForm`; no backend change
- [ ] **Time-boxed habits / programs**: "30-day push-up challenge" that ends on its own — Impact 2
  → Optional `endDate` on `Habit`; auto-archive after it passes

## Insights

- [ ] **Best / worst weekday per habit** ("you skip gym on Fridays") — Impact 3
  → Group entries by `date.getDay()` over the stats window
- [ ] **Completion-rate trend** (this month vs last month) — Impact 3
  → Two windowed `computeTotalCompletions` calls divided by due-day counts
- [ ] **Habit correlations** ("on days you exercise you sleep 40 min more") — Impact 2
  → Pairwise comparison of entry values across habits on the same dates; needs enough history to mean anything
- [ ] **Weekly review screen**: a summary each Sunday with wins, misses, and streaks at risk — Impact 3
  → A `weeklyReview(weekStart)` query that aggregates existing stats

## Journaling & mood

- [ ] **Daily mood / energy check-in** (1–5) — Impact 3
  → Can be modelled as a built-in habit with `unit: "mood"`, so it reuses entries, heatmaps and streaks with no new tables
- [ ] **Daily journal note** that isn't tied to a single habit — Impact 2
  → `JournalEntry(date, body)`; shown in the day view
- [ ] **Mood overlay on heatmaps**: tint a habit's heatmap by that day's mood — Impact 1

## Cross-module (habits × finance)

These link the habit tracker to the finance module
([finance/index.md](../finance/index.md)). See
[finance/habits-integration.md](../finance/habits-integration.md) for the design.

- [ ] **"No-spend day" habit auto-checked from transactions** — Impact 3
- [ ] **Savings-goal contributions count as check-ins** ("save £10/day") — Impact 3
- [ ] **Cost of a habit**: link a habit to a spending category ("coffee", "gym") and show spend next to the streak — Impact 2
- [ ] **Unified "LifeOS level"**: XP from both habits and financial discipline (staying under budget) — Impact 2

## Explicitly out of scope for v1

- Multi-user auth/accounts — every habit is implicitly single-user for now
  (no `User` entity, no login).
- Reminders/notifications.
- A UI for defining typed custom fields (the EAV model in the data-model
  doc) — `metadata` JSON covers the same need with less machinery.
