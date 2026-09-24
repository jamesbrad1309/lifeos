import { useMutation } from "@apollo/client/react";
import { CornerDownRight, X } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { SlashTextarea, type SlashTextareaHandle } from "#components/journal/SlashTextarea";
import { Button } from "#components/ui/button";
import {
  CREATE_JOURNAL_ENTRIES_MUTATION,
  JOURNAL_REFETCH,
  UPDATE_JOURNAL_ENTRY_MUTATION,
} from "#graphql/journal";
import type { JournalEntry, JournalEntryDraft, JournalEntryKind } from "#graphql/types";
import { formatDuration, nowTime, todayIsoDate } from "#lib/dates";
import { INTENSITY_LABELS, emotionFor } from "#lib/emotions";
import { KIND_BY_ID } from "#lib/journal-kinds";
import {
  type ParsedItem,
  SLASH_COMMANDS,
  parseJournalText,
  serializeEntry,
} from "#lib/journal-syntax";
import { cn } from "#lib/utils";

const PLACEHOLDER = `- /event Client moved the deadline (-)
  - /feeling stressed 4/5 not sure we can ship
- /action went for a walk 20m`;

const TONE_LABEL = { POSITIVE: "👍 good", NEUTRAL: "😐 neutral", NEGATIVE: "👎 rough" } as const;

/** Lets JournalView drive the composer from shortcuts and an event's "How did it feel?" button. */
export interface ComposerHandle {
  start(kind: JournalEntryKind, linkTo?: { id: string; text: string }): void;
}

interface Props {
  date: string;
  /** Present in edit mode: one line of syntax that replaces this entry. */
  entry?: JournalEntry;
  onDone?: () => void;
  ref?: Ref<ComposerHandle>;
}

/** Writing about today: it probably just happened. A past day: no guess. */
function defaultTime(date: string): string | null {
  return date === todayIsoDate() ? nowTime() : null;
}

function toDraft(item: ParsedItem, date: string, time: string | null): JournalEntryDraft {
  const draft: JournalEntryDraft = { date, kind: item.kind, time, text: item.text };
  if (item.kind === "ACTION") draft.durationMinutes = item.durationMinutes;
  if (item.kind === "FEELING") {
    draft.emotion = item.emotion;
    draft.intensity = item.intensity;
  }
  if (item.kind === "EVENT") draft.tone = item.tone;
  return draft;
}

export function JournalComposer({ date, entry, onDone, ref }: Props) {
  const editing = entry !== undefined;
  const [text, setText] = useState(() => (entry ? serializeEntry(entry) : ""));
  /** Set by an event's "How did it feel?": top-level feelings/actions get linked to it. */
  const [linkTo, setLinkTo] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Problems are only shown once you try to save — not while you're mid-line. */
  const [showIssues, setShowIssues] = useState(false);
  const textareaRef = useRef<SlashTextareaHandle>(null);

  const [createEntries, { loading: creating }] = useMutation(CREATE_JOURNAL_ENTRIES_MUTATION, {
    refetchQueries: JOURNAL_REFETCH,
  });
  const [updateEntry, { loading: updating }] = useMutation(UPDATE_JOURNAL_ENTRY_MUTATION, {
    refetchQueries: JOURNAL_REFETCH,
  });
  const saving = creating || updating;

  const { items, issues } = parseJournalText(text);
  const editProblem =
    editing && items.length > 1 ? "Editing changes one entry. Keep it to a single line." : null;
  const hasProblems = issues.length > 0 || editProblem !== null;
  const empty = items.length === 0 && issues.length === 0;

  const linksTo = (item: ParsedItem) =>
    linkTo !== null && item.kind !== "EVENT" && item.triggerIndex === null && item.indent === 0;

  useImperativeHandle(ref, () => ({
    start(kind, nextLinkTo) {
      if (nextLinkTo) setLinkTo(nextLinkTo);
      const word = SLASH_COMMANDS.find((c) => c.kind === kind)?.word;
      const line = `- /${word} `;
      // Drop a trailing empty bullet before appending the new item.
      const kept = text.replace(/\n?[ \t]*-?[ \t]*$/, "");
      textareaRef.current?.setValue(kept ? `${kept}\n${line}` : line);
    },
  }));

  async function submit() {
    if (saving || empty) return;
    if (hasProblems) {
      setShowIssues(true);
      return;
    }
    setError(null);
    try {
      if (editing) {
        const item = items[0];
        // Removing the @time on edit means "sometime that day", so no default here.
        const input = toDraft(item, date, item.time);
        // The syntax can't name an existing event, so an edit keeps the current link.
        input.triggerId = item.kind === "EVENT" ? null : (entry.trigger?.id ?? null);
        await updateEntry({ variables: { id: entry.id, input } });
        onDone?.();
        return;
      }

      const fallbackTime = defaultTime(date);
      const drafts = items.map((item) => {
        const draft = toDraft(item, date, item.time ?? fallbackTime);
        if (item.triggerIndex !== null) draft.triggerIndex = item.triggerIndex;
        else if (linksTo(item)) draft.triggerId = linkTo?.id;
        return draft;
      });
      await createEntries({ variables: { entries: drafts } });
      setShowIssues(false);
      setLinkTo(null);
      // Ready for the next list, focus kept.
      textareaRef.current?.setValue("- ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {linkTo && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs">
          <CornerDownRight className="size-3.5 shrink-0 text-amber-600" />
          <span className="truncate text-muted-foreground">
            New feelings and actions will be linked to{" "}
            <span className="font-medium text-foreground">“{linkTo.text}”</span>
          </span>
          <button
            type="button"
            aria-label="Don't link"
            onClick={() => setLinkTo(null)}
            className="ml-auto rounded p-0.5 hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <SlashTextarea
        ref={textareaRef}
        value={text}
        onChange={setText}
        onSubmit={() => void submit()}
        onCancel={onDone}
        multiline={!editing}
        autoFocus={editing}
        placeholder={editing ? "/action …" : PLACEHOLDER}
        aria-label={editing ? "Edit entry" : "Journal entries"}
      />

      {items.length > 0 && !editing && (
        <ul className="flex flex-col gap-1 rounded-md bg-muted/50 p-2" aria-label="Preview">
          {items.map((item) => (
            <PreviewRow
              key={item.line}
              item={item}
              trigger={
                item.triggerIndex !== null
                  ? items[item.triggerIndex].text
                  : linksTo(item)
                    ? (linkTo?.text ?? null)
                    : null
              }
            />
          ))}
        </ul>
      )}

      {showIssues && hasProblems && (
        <ul className="flex flex-col gap-0.5 text-xs text-destructive">
          {editProblem && <li>{editProblem}</li>}
          {issues.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>
              {editing ? "" : `Line ${issue.line + 1}: `}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <Kbd>/</Kbd> action, feeling or event ·{" "}
          {editing ? (
            ""
          ) : (
            <>
              <Kbd>Tab</Kbd> nests under an event ·{" "}
            </>
          )}
          optional <Kbd>20m</Kbd> <Kbd>4/5</Kbd> <Kbd>(+)</Kbd> <Kbd>(-)</Kbd> <Kbd>@9:30</Kbd>{" "}
          <Kbd>#tag</Kbd>
        </p>
        <div className="ml-auto flex items-center gap-2">
          {editing && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="button" size="sm" disabled={saving || empty} onClick={() => void submit()}>
            {editing ? "Save" : `Add${items.length > 1 ? ` ${items.length}` : ""}`}
            <span className="text-[10px] opacity-60">{editing ? "↵" : "⌘↵"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One parsed line, shown as it will be saved, so the syntax is never taken on faith. */
function PreviewRow({ item, trigger }: { item: ParsedItem; trigger: string | null }) {
  const config = KIND_BY_ID[item.kind];
  const Icon = config.icon;
  const emotion = item.emotion ? emotionFor(item.emotion) : null;
  return (
    <li
      className="flex min-w-0 items-center gap-2 text-xs"
      style={{ paddingLeft: Math.min(item.indent, 8) * 8 }}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          config.dotClass,
        )}
      >
        <Icon className="size-3" />
      </span>
      {emotion && (
        <span className="shrink-0 font-medium capitalize">
          {emotion.emoji} {emotion.name}
          {item.intensity !== null && item.intensity !== 3 && (
            <span className="ml-1 font-normal lowercase text-muted-foreground">
              ({INTENSITY_LABELS[item.intensity - 1]})
            </span>
          )}
        </span>
      )}
      <span className="truncate">{item.text}</span>
      {item.durationMinutes && <Tag>{formatDuration(item.durationMinutes)}</Tag>}
      {item.tone && <Tag>{TONE_LABEL[item.tone]}</Tag>}
      {item.time && <Tag>{item.time}</Tag>}
      {trigger && (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
          <CornerDownRight className="size-3" />
          <span className="max-w-40 truncate">{trigger}</span>
        </span>
      )}
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px]">{children}</span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-background px-1 font-mono text-[10px]">{children}</kbd>;
}
