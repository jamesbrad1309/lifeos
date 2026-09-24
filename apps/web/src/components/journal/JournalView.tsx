import { useMutation, useQuery } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";
import { type ComposerHandle, JournalComposer } from "#components/journal/JournalComposer";
import { JournalEntryItem } from "#components/journal/JournalEntryItem";
import { WeekStrip } from "#components/journal/WeekStrip";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import {
  DELETE_JOURNAL_ENTRY_MUTATION,
  JOURNAL_ENTRIES_QUERY,
  JOURNAL_REFETCH,
} from "#graphql/journal";
import type { JournalEntriesData, JournalEntryKind } from "#graphql/types";
import { useUndoableDelete } from "#hooks/useUndoableDelete";
import { addDays, formatDayHeading, todayIsoDate } from "#lib/dates";
import { valenceMix } from "#lib/emotions";
import { KINDS } from "#lib/journal-kinds";
import { cn } from "#lib/utils";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * A day's journal: what you did, felt, and what happened, on one timeline.
 * Keyboard: d / f / h start an entry of that kind, ← / → move between
 * days, t jumps back to today.
 */
export function JournalView() {
  const [date, setDate] = useState(todayIsoDate);
  const [kindFilter, setKindFilter] = useState<JournalEntryKind | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const composerRef = useRef<ComposerHandle>(null);

  const { data, loading, error } = useQuery<JournalEntriesData>(JOURNAL_ENTRIES_QUERY, {
    variables: { date },
  });
  const [deleteEntry] = useMutation(DELETE_JOURNAL_ENTRY_MUTATION, {
    refetchQueries: JOURNAL_REFETCH,
    awaitRefetchQueries: true,
  });
  const deletes = useUndoableDelete((id) => deleteEntry({ variables: { id } }));

  const today = todayIsoDate();

  function goTo(next: string) {
    setDate(next > today ? today : next);
    setEditingId(null);
    setTagFilter(null);
  }

  // Latest-closure ref so the keydown listener is registered once.
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  function onShortcut(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const kind = KINDS.find((config) => config.shortcut === e.key);
    if (kind) {
      e.preventDefault();
      setEditingId(null);
      composerRef.current?.start(kind.kind);
    } else if (e.key === "ArrowLeft") {
      goTo(addDays(date, -1));
    } else if (e.key === "ArrowRight") {
      goTo(addDays(date, 1));
    } else if (e.key === "t") {
      goTo(today);
    }
  }
  useEffect(() => {
    shortcuts.current = onShortcut;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const entries = (data?.journalEntries ?? []).filter((e) => !deletes.pending.includes(e.id));
  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  const visible = entries.filter(
    (e) =>
      (kindFilter === null || e.kind === kindFilter) &&
      (tagFilter === null || e.tags.includes(tagFilter)),
  );
  const countFor = (kind: JournalEntryKind) => entries.filter((e) => e.kind === kind).length;
  const mood = valenceMix(entries.flatMap((e) => (e.emotion ? [e.emotion] : [])));
  const moodTotal = mood.pleasant + mood.neutral + mood.unpleasant;

  const lastPending = deletes.pending.at(-1);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardContent className="p-2">
            <WeekStrip selected={date} onSelect={goTo} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{formatDayHeading(date)}</h2>
          {date !== today && (
            <Button variant="outline" size="sm" onClick={() => goTo(today)}>
              Back to today
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <JournalComposer key={date} ref={composerRef} date={date} />
          </CardContent>
        </Card>

        {loading && !data && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-destructive">{error.message}</p>}

        {!loading && entries.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {date === today ? "How's today going?" : "Nothing written for this day."}
            </p>
            <p className="mt-1">
              Start small: one thing you <b>did</b>, one thing you <b>felt</b>, one thing that{" "}
              <b>happened</b>.
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <Card>
            <CardContent className="p-5">
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries match this filter.</p>
              ) : (
                <ol className="flex flex-col">
                  {visible.map((entry) =>
                    entry.id === editingId ? (
                      <li
                        key={entry.id}
                        className="mb-5 rounded-xl border bg-background p-4 shadow-sm"
                      >
                        <JournalComposer
                          date={date}
                          entry={entry}
                          onDone={() => setEditingId(null)}
                        />
                      </li>
                    ) : (
                      <JournalEntryItem
                        key={entry.id}
                        entry={entry}
                        onEdit={() => setEditingId(entry.id)}
                        onDelete={() => deletes.remove(entry.id)}
                        onLogFeeling={
                          entry.kind === "EVENT"
                            ? () =>
                                composerRef.current?.start("FEELING", {
                                  id: entry.id,
                                  text: entry.text,
                                })
                            : undefined
                        }
                        onTagClick={setTagFilter}
                      />
                    ),
                  )}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm font-medium">This day</p>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <div
                  key={k.kind}
                  className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 py-2"
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full",
                      k.dotClass,
                    )}
                  >
                    <k.icon className="size-3.5" />
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{countFor(k.kind)}</span>
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">Mood mix</p>
              {moodTotal > 0 ? (
                <>
                  <div
                    className="flex h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Mood mix: ${mood.pleasant} pleasant, ${mood.neutral} neutral, ${mood.unpleasant} unpleasant`}
                  >
                    <span className="bg-emerald-500" style={{ flexGrow: mood.pleasant }} />
                    <span className="bg-zinc-400" style={{ flexGrow: mood.neutral }} />
                    <span className="bg-rose-500" style={{ flexGrow: mood.unpleasant }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{mood.pleasant} pleasant</span>
                    <span>{mood.neutral} neutral</span>
                    <span>{mood.unpleasant} unpleasant</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No feelings logged yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {entries.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="text-sm font-medium">Filter</p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip selected={kindFilter === null} onClick={() => setKindFilter(null)}>
                  All {entries.length}
                </FilterChip>
                {KINDS.map((k) => (
                  <FilterChip
                    key={k.kind}
                    selected={kindFilter === k.kind}
                    onClick={() => setKindFilter(kindFilter === k.kind ? null : k.kind)}
                  >
                    <k.icon className="size-3" /> {k.label} {countFor(k.kind)}
                  </FilterChip>
                ))}
              </div>
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <FilterChip
                      key={tag}
                      selected={tagFilter === tag}
                      onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    >
                      #{tag}
                    </FilterChip>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="hidden lg:block">
          <CardContent className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Shortcuts</p>
            <Shortcut keys={["d", "f", "h"]}>new did / felt / happened</Shortcut>
            <Shortcut keys={["←", "→"]}>previous / next day</Shortcut>
            <Shortcut keys={["t"]}>jump to today</Shortcut>
            <Shortcut keys={["⌘", "↵"]}>save the list</Shortcut>
          </CardContent>
        </Card>
      </aside>

      {lastPending && (
        <output className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          Entry deleted
          <button
            type="button"
            onClick={() => deletes.undo(lastPending)}
            className="font-semibold underline underline-offset-2"
          >
            Undo
          </button>
        </output>
      )}
    </div>
  );
}

function Shortcut({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="min-w-5 rounded border bg-muted px-1 text-center font-mono text-[10px]"
          >
            {key}
          </kbd>
        ))}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
        selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
