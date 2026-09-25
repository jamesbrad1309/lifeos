# Journal

A daily journal made of three kinds of entries, all on one timeline per day:

| Kind | What it records | Kind-specific fields |
| ---- | --------------- | -------------------- |
| **ACTION** | something you did | `durationMinutes` |
| **FEELING** | how you felt | `emotion` (a word), `intensity` 1–5 |
| **EVENT** | something that happened to you | `tone`: `POSITIVE` / `NEUTRAL` / `NEGATIVE` |

A feeling or action can point at the **event that triggered it** ("stressed
← the client moved the deadline"). Recording *why* you felt something is
where a journal starts producing insight rather than just a log.

Build status per use case is in [use-cases.md](use-cases.md) under
"Journaling & mood".

## Data model

One table, `journal_entries` (`apps/api/prisma/schema.prisma`), with a
`kind` enum and nullable kind-specific columns. That's simpler than three
tables because a day's timeline is always read as one list ordered by time.

| Column | Notes |
| ------ | ----- |
| `date` | `@db.Date`, a calendar day, sent over the wire as `"YYYY-MM-DD"` like `HabitEntry.date` |
| `time` | `"HH:mm"` local time, or null for "sometime that day" |
| `text` | Required for ACTION and EVENT. Optional for FEELING, where it's the "why" |
| `tags` | `#tags` parsed out of `text` by the API (`extractTags`), lowercased |
| `triggerId` | Self-relation to an **EVENT**. `ON DELETE SET NULL`: deleting an event keeps the feelings it triggered and only removes the link |

The API nulls the columns that don't belong to an entry's kind on every
write (`toColumns` in `journal.service.ts`), so changing an entry's kind
can't leave a stale emotion or duration behind.

The emotion vocabulary (word, emoji, pleasant/neutral/unpleasant) lives
only in the frontend (`apps/web/src/lib/emotions.ts`). The API stores any
word up to 40 characters, so the list can grow without a migration.

## API (`apps/api/src/journal/`)

| Method & path | Notes |
| ------------- | ----- |
| `GET /journal-entries?date=YYYY-MM-DD` | One day, ordered by `time` (nulls last), then `createdAt`. Each entry includes a trimmed `trigger` |
| `GET /journal-entries/days?from=…&to=…` | Per-day counts plus the day's emotions, for the week strip. At most 62 days |
| `POST /journal-entries` | One entry |
| `POST /journal-entries/batch` | A list from the composer, saved **in one transaction**. `triggerIndex` links an item to an EVENT earlier in the same list, since that event has no id yet |
| `PUT /journal-entries/:id` | Full replacement, validated by the same per-kind zod schema as create |
| `DELETE /journal-entries/:id` | Returns `{ id }` |

The batch endpoint is atomic on purpose. If one line is invalid, nothing is
saved, so retrying a failed save can't create duplicates of the lines that
did succeed.

GraphQL (`apps/bff/src/graphql/journal/`) passes these through one to one:
`journalEntries(date)`, `journalDays(from, to)`, `createJournalEntry`,
`createJournalEntries(entries)`, `updateJournalEntry`, `deleteJournalEntry`.

## The composer: one textarea, slash commands

Entries are written as a bulleted list in a single textarea. The format is
parsed by pure functions in `apps/web/src/lib/journal-syntax.ts`:

```
- /event Client moved the deadline (-) @9:30 #work
  - /feeling stressed 4/5 not sure we can ship
  - /action rewrote the plan 45m
- /action went for a walk 20m
```

- Every item starts with `/action`, `/feeling` or `/event`. `/did`, `/felt`,
  `/happened` and `/a`, `/f`, `/e` also work.
- A `/feeling`'s first word is the emotion.
- **Nesting an item under an `/event` links it to that event** (sent as
  `triggerIndex`).
- A line with no bullet or command continues the previous item's text
  (Shift+Enter).
- Optional tokens anywhere in a line:

  | Token | Meaning |
  | ----- | ------- |
  | `20m`, `1h30m`, `90min` | action duration |
  | `4/5` | feeling intensity (default 3) |
  | `(+)` `(=)` `(-)` | event tone |
  | `@9:30`, `@6pm` | time. Default: now for today, none for past days |

Problems come back as `{ line, message }` issues, e.g. "Unknown /bogus.
Use /action, /feeling or /event". They're shown only after you try to save,
not while you're partway through typing a line.

Editing an existing entry opens it as **one line** of the same syntax
(`serializeEntry`). The syntax can't refer to an already-saved event, so an
edit keeps the entry's existing trigger.

### Editor behaviour (`SlashTextarea.tsx`)

- `/` at the start of an item opens a menu of kinds, and `/feeling ` then
  offers emotion words (`suggestionsAt`). The menu is anchored at the caret
  by measuring an invisible copy of the textarea (`lib/caret.ts`), and
  follows the ARIA combobox pattern: focus stays in the textarea.
- Enter continues the list, Tab / Shift+Tab nest and un-nest, Enter on an
  empty nested bullet steps out a level, ⌘↵ saves.
- A live preview under the textarea shows how each line will be saved,
  including which event it links to.

## Journal page

`JournalView.tsx`: the week strip (each day's dominant emotion and a dot per
kind written), the composer, and the timeline, with a sticky side rail
holding the day's counts, the mood mix, kind and `#tag` filters, and
keyboard shortcuts (`d` / `f` / `h` start an entry of that kind, ← / →
change day, `t` jumps to today). Deleting shows an **Undo** toast for 5 s
instead of asking for confirmation (`hooks/useUndoableDelete.ts`).

The shown day is in the URL (`routes/journal.tsx`): `/journal` is always
today, and a past day is `/journal?date=2026-09-24`, so back/forward steps
through the days you visited and a day can be bookmarked. Future and
malformed dates show today.

**In Vietnamese** the commands are `/làm`, `/cảm` and `/sựkiện` (accents
optional: `/lam`, `/cam`, `/sukien`), and emotions can be written in
Vietnamese (`/cảm lo âu 4/5`). Emotions are always stored by their English
key (`anxious`) and shown in the current language; every language's words
parse whatever the UI language is. See [i18n.md](../frontend/i18n.md).
Parse problems are codes (`ParseIssue.code`) that the composer words.

Dates use the browser's local calendar (`lib/dates.ts`), so an entry written
at 23:30 belongs to today, not to tomorrow in UTC.
