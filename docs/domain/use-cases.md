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

## Explicitly out of scope for v1

- Multi-user auth/accounts — every habit is implicitly single-user for now
  (no `User` entity, no login).
- Reminders/notifications.
- A UI for defining typed custom fields (the EAV model in the data-model
  doc) — `metadata` JSON covers the same need with less machinery.
