# Habit Data Model

The requirement is "create a custom habit and track all the information of my
habits" — i.e. the habit shape itself should be flexible (not a fixed
"boolean did/didn't" tracker), and each check-in can carry more than a
checkbox.

## ERD

```mermaid
erDiagram
    USER ||--o{ HABIT : owns
    HABIT ||--o{ HABIT_ENTRY : "logged as"

    USER {
        uuid id PK
    }
    HABIT {
        uuid id PK
        uuid userId FK
        text name
        text icon
        text color
        text unit "nullable"
        numeric targetValue "nullable"
        jsonb schedule
        jsonb metadata
        timestamptz archivedAt "nullable"
        timestamptz createdAt
        timestamptz updatedAt
    }
    HABIT_ENTRY {
        uuid id PK
        uuid habitId FK
        date date
        numeric value "nullable"
        boolean completed
        text note "nullable"
        jsonb metadata
        timestamptz createdAt
    }
```

`(habitId, date)` on `HABIT_ENTRY` is a unique constraint, not a separate
relation — see the note below the table.

If custom fields later move from JSONB to the EAV model described below, add:

```mermaid
erDiagram
    HABIT ||--o{ CUSTOM_FIELD_DEFINITION : defines
    CUSTOM_FIELD_DEFINITION ||--o{ CUSTOM_FIELD_VALUE : "typed by"
    HABIT_ENTRY ||--o{ CUSTOM_FIELD_VALUE : has

    CUSTOM_FIELD_DEFINITION {
        uuid id PK
        uuid habitId FK
        text key
        text type "enum: text, number, boolean, select"
        jsonb options "e.g. select choices"
    }
    CUSTOM_FIELD_VALUE {
        uuid id PK
        uuid habitEntryId FK
        uuid fieldDefinitionId FK
        jsonb value
    }
```

This second diagram is **not** part of the recommended starting schema — see
"Handling 'custom' fields" below for when it'd actually be worth adding.

## Core entities

**`Habit`** — the definition, created once, edited rarely.

| field          | type                              | notes                                   |
|----------------|-----------------------------------|------------------------------------------|
| `id`           | uuid                               |                                          |
| `userId`       | uuid                               | owner (even single-user apps benefit from this for future auth) |
| `name`         | text                                |                                          |
| `icon`/`color` | text                                | for UI                                  |
| `unit`         | text, nullable                     | e.g. "pages", "minutes", "reps"; null = simple boolean habit |
| `targetValue`  | numeric, nullable                  | e.g. 30 (minutes), 8 (glasses of water) |
| `schedule`     | jsonb                               | see "Schedule" below                    |
| `metadata`     | jsonb                               | freeform custom fields (see below)      |
| `archivedAt`   | timestamptz, nullable              | soft-archive instead of delete          |
| `createdAt`/`updatedAt` | timestamptz               |                                          |

**`HabitEntry`** — one check-in/log for a habit on a given day.

| field        | type                | notes                                          |
|--------------|---------------------|-------------------------------------------------|
| `id`         | uuid                |                                                  |
| `habitId`    | uuid (FK)           |                                                  |
| `date`       | date                | the day this entry belongs to (not `createdAt`) |
| `value`      | numeric, nullable   | actual amount for the day (vs. `targetValue`)   |
| `completed`  | boolean             | derived or explicit, for boolean-style habits   |
| `note`       | text, nullable      | free-text journal for that entry                |
| `metadata`   | jsonb               | freeform per-entry custom data                  |
| `createdAt`  | timestamptz         |                                                  |

Unique constraint on `(habitId, date)` — one entry per habit per day (adjust
if a habit can be logged multiple times/day, e.g. water glasses as separate
rows instead of a summed `value`).

## Handling "custom" fields: JSONB vs. EAV

Two ways to let users attach arbitrary extra info to a habit or entry:

1. **JSONB `metadata` column (recommended to start).** Store
   arbitrary key/value pairs directly on `Habit`/`HabitEntry`. Simple, no
   extra tables, Postgres indexes JSONB fine (`GIN` index) if you need to
   query by a custom field later. Downside: no schema/type safety on the
   custom fields themselves — validate shape in the NestJS DTO layer.
2. **EAV model** (`CustomFieldDefinition` + `CustomFieldValue` tables) — lets
   users define typed custom fields (e.g. "mood: enum[great,ok,bad]") that
   show up as real form inputs. More correct for a "field builder" UI, but
   meaningfully more backend/frontend complexity (dynamic form rendering,
   per-type validation, migrations-free schema evolution).

Start with (1). It satisfies "track all the information" for a personal
tool immediately; migrate specific popular custom fields into first-class
columns as patterns emerge, and only build (2) if you actually want a
user-facing "add a custom field" builder UI.

## Derived data (computed, not stored)

Streaks, completion rate, and "due today" are computed from `Habit.schedule`
+ `HabitEntry` rows, not stored as columns — storing them invites drift.
Compute in the GraphQL resolver/service layer (see
[graphql-bff.md](../backend/graphql-bff.md)) or as a Postgres view if it
becomes a performance concern.

## Schedule shape (habit frequency)

Store as JSONB so "every day", "3x/week", "specific weekdays", and "every N
days" are all representable without a schema migration per new pattern:

```json
// every day
{ "type": "daily" }

// specific weekdays
{ "type": "weekly", "daysOfWeek": [1, 3, 5] }

// N times per week, any days
{ "type": "timesPerWeek", "count": 3 }

// every N days
{ "type": "interval", "everyNDays": 2 }
```
