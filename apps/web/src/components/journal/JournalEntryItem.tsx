import { CornerDownRight, Heart, Pencil, Trash2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Badge } from "#components/ui/badge";
import type { JournalEntry } from "#graphql/types";
import { useSyntaxLanguage } from "#hooks/useSyntaxLanguage";
import { formatDuration } from "#lib/dates";
import { emotionFor } from "#lib/emotions";
import { KIND_BY_ID } from "#lib/journal-kinds";
import { emotionName } from "#lib/journal-syntax";
import { capitalizeFirst, cn } from "#lib/utils";

const TONE_BADGE = {
  POSITIVE: {
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  NEUTRAL: {
    className: "border-transparent bg-secondary text-secondary-foreground",
  },
  NEGATIVE: {
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
} as const;

interface Props {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  /** EVENT only: start a FEELING linked to this event. */
  onLogFeeling?: () => void;
  onTagClick: (tag: string) => void;
}

export function JournalEntryItem({ entry, onEdit, onDelete, onLogFeeling, onTagClick }: Props) {
  const { t } = useTranslation();
  const language = useSyntaxLanguage();
  const intensityLabels = t("journal.intensity", { returnObjects: true });
  const config = KIND_BY_ID[entry.kind];
  const Icon = config.icon;
  const emotion = entry.emotion ? emotionFor(entry.emotion) : null;

  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      {/* rail connecting the dots — hidden on the last item */}
      <span
        aria-hidden
        className="absolute top-8 bottom-0 left-4 w-px bg-border group-last:hidden"
      />

      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
          config.dotClass,
        )}
        title={t(`journal.kinds.${entry.kind}.label`)}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
            {entry.time ?? "—"}
          </span>

          {emotion && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <span aria-hidden className="text-base">
                {emotion.emoji}
              </span>
              {capitalizeFirst(emotionName(emotion.name, language))}
              {entry.intensity && (
                <span
                  className="flex items-center gap-0.5"
                  title={intensityLabels[entry.intensity - 1]}
                  aria-label={t("journal.intensityLabel", {
                    label: intensityLabels[entry.intensity - 1],
                  })}
                >
                  {intensityLabels.map((label, i) => (
                    <span
                      key={label}
                      className={cn(
                        "size-1.5 rounded-full",
                        i < (entry.intensity ?? 0) ? "bg-violet-500" : "bg-muted-foreground/25",
                      )}
                    />
                  ))}
                </span>
              )}
            </span>
          )}

          {entry.durationMinutes && (
            <Badge variant="secondary">{formatDuration(entry.durationMinutes)}</Badge>
          )}
          {entry.tone && (
            <Badge className={TONE_BADGE[entry.tone].className}>
              {t(`journal.tones.${entry.tone}`)}
            </Badge>
          )}

          <div className="ml-auto flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            {onLogFeeling && (
              <IconButton label={t("journal.entry.howDidItFeel")} onClick={onLogFeeling}>
                <Heart className="size-3.5" />
              </IconButton>
            )}
            <IconButton label={t("common.edit")} onClick={onEdit}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton label={t("common.delete")} onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        </div>

        {entry.text && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
            <TaggedText text={entry.text} onTagClick={onTagClick} />
          </p>
        )}

        {entry.trigger && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3 shrink-0" />
            <Trans
              i18nKey="journal.entry.becauseOf"
              values={{ text: entry.trigger.text }}
              components={{ b: <span className="truncate font-medium" /> }}
            />
          </p>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Renders `#tags` inside the text as clickable filters. */
function TaggedText({ text, onTagClick }: { text: string; onTagClick: (tag: string) => void }) {
  const parts = text.split(/(#[\p{L}\p{N}_-]+)/u);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <button
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reorder
        key={i}
        type="button"
        onClick={() => onTagClick(part.slice(1).toLowerCase())}
        className="rounded bg-accent px-1 font-medium text-foreground hover:bg-primary hover:text-primary-foreground"
      >
        {part}
      </button>
    ) : (
      part
    ),
  );
}
