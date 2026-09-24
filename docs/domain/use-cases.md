# Use Cases

What the habit tracker actually needs to do (finance use cases live in
[finance/use-cases.md](../finance/use-cases.md)), driving the data model
([habit-data-model.md](habit-data-model.md)) and the GraphQL schema
([graphql-bff.md](../backend/graphql-bff.md)). **Status**: ✅ built · ⬜ not built
yet, as of this doc's last edit. Re-verify against the code before trusting
a ⬜. Rows are grouped by category and sorted by impact within each group.
The **Cross-module** rows link habits to the planned finance module; see
[finance/index.md](../finance/index.md) and
[finance/habits-integration.md](../finance/habits-integration.md).

**Impact score** (1–5, how much the product suffers without it): `5` core
loop, unusable without it · `4` high-value, used daily · `3` meaningfully
improves UX · `2` edge case / power-user · `1` speculative.

## At a glance

| Area | Built | Open | Top open item (impact) |
| ---- | :---: | :--: | ---------------------- |
| Habit management | 6 | 2 | Unarchive / view archived habits (2) |
| Daily tracking | 4 | 1 | Add a note to today's entry (2) |
| Dashboard & gamification | 3 | 1 | See longest streak / total completions per habit (2) |
| Calendar | 2 | 1 | Week or month calendar view (2) |
| History & review | 0 | 2 | View a single habit's full entry history (2) |
| Motivation & rewards | 0 | 5 | Streak freeze (3) |
| Routines & structure | 0 | 4 | Habit stacking / routines (3) |
| Insights | 0 | 4 | Best / worst weekday per habit (3) |
| Journaling & mood | 6 | 4 | Which events drive which feelings (3) |
| Cross-module (habits × finance) | 0 | 5 | "No-spend day" habit auto-checked from transactions (3) |
| **Finance** (separate doc) | 0 | 50 | Money setup and quick log, see [finance/use-cases.md](../finance/use-cases.md) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Habit management** | ✅ | **Create a custom habit** (name, icon/color, unit, target, schedule) | 5 | `Mutation.createHabit` |
|  | ✅ | **Edit a habit's definition** (name/unit/target/schedule/start time) | 4 | `Mutation.updateHabit` + `EditHabitDialog` |
|  | ✅ | **Configure a schedule preset** (daily / weekdays / weekends / custom days / N×week / every N days) | 4 | `ScheduleEditor`; presets are just `weekly` with specific `daysOfWeek`, no extra schema |
|  | ✅ | **Set a start time** for the day-calendar view | 3 | `Habit.startTime` ("HH:mm") |
|  | ✅ | **Archive a habit** (soft-delete, keeps history) | 3 | `Mutation.archiveHabit` |
|  | ✅ | **Pause a habit** (skip it without archiving) | 3 | `Mutation.pauseHabit`/`resumeHabit`; excluded from `todayHabits` and the day view while paused |
|  | ⬜ | **Unarchive / view archived habits** | 2 | Backend done (`unarchiveHabit`, `archivedHabits` query) — no frontend UI yet |
|  | ⬜ | **Attach arbitrary custom fields to a habit** | 1 | Backend accepts `metadata` JSON on create — no UI to add/edit it |
| **Daily tracking** | ✅ | **See which habits are due today** | 5 | `Query.todayHabits`; day view applies the same `isDueOn` filter client-side |
|  | ✅ | **Check a habit off for today** | 5 | `Mutation.upsertHabitEntry` (`completed: true`) |
|  | ✅ | **Log a quantitative value for today** | 4 | `Mutation.upsertHabitEntry` (`value: 5`) |
|  | ✅ | **Re-check/correct today's entry without duplicating** | 3 | Upsert on `(habitId, date)` by design |
|  | ⬜ | **Add a note to today's entry** | 2 | Backend field exists (`note`) — no note input in either UI view |
| **Dashboard & gamification** | ✅ | **See aggregate level/XP/streak stats across all habits** | 4 | `Query.dashboardStats`, `StatTiles` + the sidebar's level card |
|  | ✅ | **See per-habit streak, points, and level** | 4 | `Habit.currentStreak`/`points`/`level`, shown as card badges |
|  | ✅ | **See a GitHub-style contribution heatmap per habit** | 3 | `Habit.heatmap`, `HeatmapGrid` (120-day window) |
|  | ⬜ | **See longest streak / total completions per habit** | 2 | Queried (`longestStreak`, `totalCompletions`) but not displayed in either view yet |
| **Calendar** | ✅ | **Day view: today's due habits on a time-of-day timeline** | 4 | `DayCalendar`, positions habits by `startTime`; untimed habits in a checkable "Anytime today" list beside it |
|  | ✅ | **Check a habit off directly from the day view** | 4 | Same `upsertHabitEntry` mutation as the dashboard card |
|  | ⬜ | **Week or month calendar view** | 2 | Only a single day view exists so far |
| **History & review** | ⬜ | **View a single habit's full entry history** (list, not just heatmap) | 2 | `Query.habitEntries(habitId)` exists — no history list UI |
|  | ⬜ | **Habit detail page** | 1 | `Query.habit(id)` exists — no dedicated route/page, everything lives on the dashboard card |
| **Motivation & rewards** | ⬜ | **Streak freeze**: spend earned points to protect a streak on a missed day | 3 | A `StreakFreeze(habitId, date)` row; `streak.util.ts` treats a frozen day as "not due", like a paused habit |
|  | ⬜ | **Achievements / badges** ("First 7-day streak", "100 check-ins", "Perfect week") | 3 | Derived from entries at query time, the same way points are; no stored "unlocked" flag is needed until unlocks need a timestamp |
|  | ⬜ | **Milestone celebration** when a streak reaches 7 / 30 / 100 days | 2 | Frontend only: compare `currentStreak` before and after `upsertHabitEntry` |
|  | ⬜ | **Weekly challenge**: a temporary target, e.g. "meditate 5× this week for 2× XP" | 2 | `Challenge` entity with a date range and a multiplier fed into `computePoints` |
|  | ⬜ | **Reward shop**: trade points for self-defined rewards ("takeaway night = 500 pts") | 2 | Needs a spent-points ledger, because points are currently derived and can't be decreased |
| **Routines & structure** | ⬜ | **Habit stacking / routines**: group habits into an ordered "Morning routine" and check them off in sequence | 3 | `Routine` plus an ordered join table; the day view renders a routine as one block at its first habit's `startTime` |
|  | ⬜ | **Negative habits** ("no sugar", "no doomscrolling"): success is the *absence* of an event | 3 | A `polarity: "avoid"` flag; a due day counts as successful unless an entry marks a slip |
|  | ⬜ | **Habit templates**: start from a preset such as "Drink 2L water" or "Read 20 pages" | 2 | A static list on the frontend that pre-fills `CreateHabitForm`; no backend change |
|  | ⬜ | **Time-boxed habits / programs**: "30-day push-up challenge" that ends on its own | 2 | Optional `endDate` on `Habit`; auto-archive after it passes |
| **Insights** | ⬜ | **Best / worst weekday per habit** ("you skip gym on Fridays") | 3 | Group entries by `date.getDay()` over the stats window |
|  | ⬜ | **Completion-rate trend** (this month vs last month) | 3 | Two windowed `computeTotalCompletions` calls divided by due-day counts |
|  | ⬜ | **Weekly review screen**: a summary each Sunday with wins, misses, and streaks at risk | 3 | A `weeklyReview(weekStart)` query that aggregates existing stats |
|  | ⬜ | **Habit correlations** ("on days you exercise you sleep 40 min more") | 2 | Pairwise comparison of entry values across habits on the same dates; needs enough history to mean anything |
| **Journaling & mood** | ✅ | **Log what you did** (an ACTION, with optional duration) | 4 | One textarea: bulleted `/action` lines, parsed by `apps/web/src/lib/journal-syntax.ts`; saved atomically by `Mutation.createJournalEntries` |
|  | ✅ | **Log how you felt** (a FEELING: emotion word + 1–5 intensity, optional "why") | 4 | `/feeling anxious 4/5 why…`; the slash menu autocompletes emotions from `apps/web/src/lib/emotions.ts` |
|  | ✅ | **Log what happened** (an EVENT, tagged good / neutral / rough) | 4 | `/event … (+)` / `(=)` / `(-)` for tone |
|  | ✅ | **Link a feeling or action to the event behind it** ("stressed ← deadline moved") | 3 | Indent an item under an `/event` in the same list (`triggerIndex`), or press ♥ on a saved event; stored as `JournalEntry.triggerId` (`SET NULL` on delete) |
|  | ✅ | **Browse past days** with a week strip showing each day's dominant emotion | 3 | `Query.journalDays(from, to)`; ← / → and `t` shortcuts |
|  | ✅ | **#tags and filters** by kind or tag within a day | 2 | `tags` parsed from `text` by the API |
|  | ⬜ | **Which events drive which feelings** (e.g. "#work events are followed by stress 70% of the time") | 3 | Group FEELING entries by their trigger's tags over a window |
|  | ⬜ | **Search the whole journal** by text or tag across all days | 2 | `journalEntries` only takes a single `date` today |
|  | ⬜ | **Daily mood as a streakable habit** | 2 | FEELING entries capture mood, but there's no daily "checked in" streak or heatmap for it |
|  | ⬜ | **Mood overlay on heatmaps**: tint a habit's heatmap by that day's mood | 1 | Join FEELING entries' valence onto `Habit.heatmap` by date |
| **Cross-module (habits × finance)** | ⬜ | **"No-spend day" habit auto-checked from transactions** | 3 | Finance upserts `HabitEntry`, see [habits-integration.md §1](../finance/habits-integration.md#1-no-spend-day-habit-auto-checked) |
|  | ⬜ | **Savings-goal contributions count as check-ins** ("save £10/day") | 3 | `SavingsGoal.habitId`, see [habits-integration.md §2](../finance/habits-integration.md#2-savings-goal-as-a-habit) |
|  | ⬜ | **"Log today's spending" habit**: an evening habit that opens quick log and counts as done once anything is logged that day | 3 | Auto-checked like no-spend days; see [habits-integration.md §5](../finance/habits-integration.md#5-log-todays-spending-habit) |
|  | ⬜ | **Cost of a habit**: link a habit to a spending category ("coffee", "gym") and show spend next to the streak | 2 | `Habit.linkedSpendMinor(month)`, see [habits-integration.md §3](../finance/habits-integration.md#3-cost-of-a-habit) |
|  | ⬜ | **Unified "LifeOS level"**: XP from both habits and financial discipline (staying under budget) | 2 | Finance XP added in `gamification.util.ts`, see [habits-integration.md §4](../finance/habits-integration.md#4-unified-lifeos-xp) |

## Explicitly out of scope for v1

- Multi-user auth/accounts — every habit is implicitly single-user for now
  (no `User` entity, no login).
- Reminders/notifications.
- A UI for defining typed custom fields (the EAV model in the data-model
  doc) — `metadata` JSON covers the same need with less machinery.
