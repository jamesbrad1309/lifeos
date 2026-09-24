# Knowledge Graph

A bird's-eye map of how the pieces documented across `docs/` connect: domain
entities → use-case groups ([use-cases.md](use-cases.md)) → the backend code
that implements them → the frontend that surfaces them. Use it to find "if I
want to touch X, what else is involved" before diving into a specific doc.

```mermaid
graph TD
    subgraph Domain["Domain model — habit-data-model.md"]
        Habit["Habit"]
        Entry["HabitEntry"]
        Habit -->|has many| Entry
        Journal["JournalEntry<br/>ACTION · FEELING · EVENT"]
        Journal -->|triggered by an EVENT| Journal
    end

    subgraph UseCases["Use-case groups — use-cases.md"]
        Manage["Habit management<br/>create · edit · archive · pause"]
        Track["Daily tracking<br/>check-in · value · note"]
        Dash["Dashboard & gamification<br/>streaks · points · level · heatmap"]
        Cal["Calendar<br/>day timeline by startTime"]
        Hist["History & review<br/>per-habit entry log"]
        JournalUC["Journaling & mood<br/>did · felt · happened · because of"]
    end

    subgraph Backend["Backend — graphql-bff.md, nestjs-structure.md, prisma-and-data-access.md"]
        GQL["apps/bff: GraphQL resolvers + DataLoaders<br/>graphql/habits, graphql/dashboard, graphql/journal"]
        REST["apps/api: REST controllers<br/>/habits, /habit-entries, /dashboard, /journal-entries"]
        Services["HabitsService / HabitEntriesService / HabitStatsService"]
        JournalSvc["JournalService"]
        Streak["streak.util.ts"]
        Gamif["gamification.util.ts"]
        Prisma["Prisma / Postgres"]
    end

    subgraph Frontend["Frontend — react-shadcn setup"]
        Card["HabitCard"]
        EditDlg["EditHabitDialog + ScheduleEditor"]
        DayCal["DayCalendar"]
        Header["StatTiles + sidebar LevelCard"]
        Heatmap["HeatmapGrid"]
        JournalUI["JournalView<br/>JournalComposer + SlashTextarea · WeekStrip"]
    end

    Manage --> Habit
    Track --> Entry
    Dash --> Entry
    Cal --> Habit
    Hist --> Entry
    JournalUC --> Journal

    Manage --> Services
    Track --> Services
    Dash --> Services
    Dash --> Streak
    Dash --> Gamif
    Cal --> Services
    Hist --> Services

    JournalUC --> JournalSvc
    Services --> Prisma
    JournalSvc --> Prisma
    REST --> JournalSvc
    GQL -->|HTTP| REST
    REST --> Services

    Manage --> EditDlg
    Track --> Card
    Dash --> Header
    Dash --> Heatmap
    Cal --> DayCal
    JournalUC --> JournalUI

    EditDlg --> GQL
    Card --> GQL
    DayCal --> GQL
    Header --> GQL
    JournalUI --> GQL
```

## How to read it

- **Domain → Use cases**: which entity a use-case group primarily reads or
  writes. Dashboard & gamification and History & review both center on
  `HabitEntry` because streaks, points, heatmaps, and history are all
  *derived from* entries, never stored themselves (see "Derived data" in
  the data model doc) — this is why `streak.util.ts`/`gamification.util.ts`
  sit directly under Dashboard rather than under a generic "utils" bucket.
- **Use cases → Backend**: every group ultimately funnels through the API's
  `HabitsService`/`HabitEntriesService`/`HabitStatsService`, reached from the
  BFF's resolvers over REST. Behaviour changes go in those services. A BFF
  change is only needed when the GraphQL shape changes.
- **Use cases → Frontend**: mostly 1:1 with a component, except Dashboard,
  which spans three (`StatTiles` and the sidebar's level card for aggregate stats, `HabitCard` for
  per-habit stats, `HeatmapGrid` for the contribution grid) — a change to
  the points/level formula (`gamification.util.ts`) can visibly affect all
  three at once.
- **History & review has no frontend node** — matches its unchecked boxes in
  [use-cases.md](use-cases.md): the backend query (`habitEntries`) exists,
  nothing renders it yet.

- **Journaling is its own island.** `JournalEntry` has no relation to
  `Habit` yet. Its only link is to itself (a feeling or action → the event
  that triggered it). See [journal.md](journal.md).

## Planned: finance module

The finance module ([finance/index.md](../finance/index.md)) is designed as a
parallel subgraph: `Account → Transaction ← Category`, `Budget → Category`,
served by `FinanceModule` REST controllers in `apps/api` and `graphql/finance/` in `apps/bff`. The only edges
into the habits graph are listed in
[finance/habits-integration.md](../finance/habits-integration.md), and they
run one way: finance writes `HabitEntry` rows through
`HabitEntriesService`. The habits code never imports finance. Add finance
to the diagram once it's built.

Regenerate this diagram (by hand — it's illustrative, not derived from code)
whenever a use case moves to a different service/component, or a new
use-case group is added to use-cases.md.
