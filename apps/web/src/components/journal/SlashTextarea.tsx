import { type Ref, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { caretCoordinates } from "#lib/caret";
import { KIND_BY_ID } from "#lib/journal-kinds";
import { type Suggestion, type SyntaxLanguage, suggestionsAt } from "#lib/journal-syntax";
import { capitalizeFirst, cn } from "#lib/utils";

const MENU_WIDTH = 288;
const BULLET = /^(\s*)([-*•]\s+)?/;

export interface SlashTextareaHandle {
  focus(): void;
  /** Replaces the value and puts the caret at `caret` (default: the end). */
  setValue(value: string, caret?: number): void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  /** List mode: Enter starts a new bullet, Tab nests. Otherwise Enter submits. */
  multiline?: boolean;
  /** Focus on mount with the caret at the end — for editing an existing line. */
  autoFocus?: boolean;
  placeholder?: string;
  "aria-label": string;
  /** Which language the menu offers commands and emotion words in. */
  language?: SyntaxLanguage;
  ref?: Ref<SlashTextareaHandle>;
}

/**
 * A plain textarea that behaves like a small list editor: typing `/` at the
 * start of an item opens a menu of entry kinds, `/feeling ` then offers
 * emotion words, Enter continues the list and Tab / Shift+Tab nest items.
 */
export function SlashTextarea({
  value,
  onChange,
  onSubmit,
  onCancel,
  multiline = false,
  autoFocus = false,
  placeholder,
  "aria-label": ariaLabel,
  language = "en",
  ref,
}: Props) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  /** Escape hides the menu until the text changes again. */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuId = useId();
  const caretPlaced = useRef(false);

  const suggestions =
    focused && dismissedFor !== value ? suggestionsAt(value, caret, language) : null;
  const activeIndex = suggestions ? Math.min(active, suggestions.items.length - 1) : 0;

  function update(next: string, nextCaret: number) {
    pendingCaret.current = nextCaret;
    setCaret(nextCaret);
    setActive(0);
    onChange(next);
  }

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setValue: (next, at) => {
      // Focus first: onFocus may prefill an empty list with "- ", and this
      // value has to land after that, not be overwritten by it.
      textareaRef.current?.focus();
      update(next, at ?? next.length);
    },
  }));

  // Grow with the content, and restore the caret after programmatic edits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const menuFrom = suggestions?.from;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caret's pixel position moves with the text
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (menuFrom === undefined || !el) return;
    const coords = caretCoordinates(el, menuFrom);
    setMenuPos({
      top: coords.top + coords.lineHeight + 4,
      left: Math.max(0, Math.min(coords.left, el.clientWidth - MENU_WIDTH)),
    });
  }, [menuFrom, value]);

  function choose(suggestion: Suggestion) {
    if (!suggestions) return;
    const { from, to } = suggestions;
    update(
      value.slice(0, from) + suggestion.insert + value.slice(to),
      from + suggestion.insert.length,
    );
  }

  function lineAround(position: number) {
    const start = value.lastIndexOf("\n", position - 1) + 1;
    const newline = value.indexOf("\n", position);
    const end = newline === -1 ? value.length : newline;
    const [, indent = "", bullet = ""] = BULLET.exec(value.slice(start, end)) ?? [];
    return { start, end, text: value.slice(start, end), indent, bullet };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;

    if (suggestions) {
      const count = suggestions.items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((activeIndex + (e.key === "ArrowDown" ? 1 : count - 1)) % count);
        return;
      }
      if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
        e.preventDefault();
        choose(suggestions.items[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDismissedFor(value);
        return;
      }
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Escape") {
      onCancel?.();
      return;
    }
    if (!multiline) {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    const at = el.selectionStart;
    const line = lineAround(at);

    if (e.key === "Enter" && e.shiftKey) {
      // A continuation line, aligned under the item's text.
      e.preventDefault();
      const pad = `\n${line.indent}${" ".repeat(line.bullet.length)}`;
      update(value.slice(0, at) + pad + value.slice(el.selectionEnd), at + pad.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const emptyItem = line.bullet !== "" && line.text.trim() === line.bullet.trim();
      if (emptyItem && line.indent.length > 0) {
        // Enter on an empty nested bullet steps it back out a level.
        const outdented = `${line.indent.slice(2)}${line.bullet}`;
        update(
          value.slice(0, line.start) + outdented + value.slice(line.end),
          line.start + outdented.length,
        );
      } else if (emptyItem) {
        // …and on an empty top-level bullet ends the list.
        update(value.slice(0, line.start) + value.slice(line.end), line.start);
      } else {
        const next = `\n${line.indent}- `;
        update(value.slice(0, at) + next + value.slice(el.selectionEnd), at + next.length);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const remove = Math.min(2, line.indent.length);
        if (remove === 0) return;
        update(
          value.slice(0, line.start) + value.slice(line.start + remove),
          Math.max(line.start, at - remove),
        );
      } else {
        update(`${value.slice(0, line.start)}  ${value.slice(line.start)}`, at + 2);
      }
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={multiline ? 3 : 1}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={suggestions !== null}
        aria-controls={menuId}
        aria-autocomplete="list"
        aria-activedescendant={suggestions ? `${menuId}-${activeIndex}` : undefined}
        spellCheck
        onChange={(e) => {
          setCaret(e.target.selectionStart);
          setActive(0);
          onChange(e.target.value);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        // biome-ignore lint/a11y/noAutofocus: only set when the user just clicked Edit on an entry
        autoFocus={autoFocus}
        onFocus={(e) => {
          setFocused(true);
          if (autoFocus && !caretPlaced.current) {
            caretPlaced.current = true;
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }
          if (multiline && value === "") update("- ", 2);
        }}
        onBlur={() => {
          setFocused(false);
          if (value.trim() === "-") onChange("");
        }}
        className="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />

      {suggestions && (
        // Focus stays in the textarea (aria-activedescendant), per the ARIA
        // combobox pattern, so the listbox is deliberately not focusable.
        // biome-ignore lint/a11y/useFocusableInteractive: see above
        <div
          id={menuId}
          // biome-ignore lint/a11y/useSemanticElements: a <select> can't anchor at the caret
          role="listbox"
          aria-label={
            suggestions.items[0].type === "command"
              ? t("journal.composer.entryType")
              : t("journal.composer.emotion")
          }
          className="absolute z-20 overflow-hidden rounded-lg border bg-background p-1 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
        >
          {suggestions.items.map((item, i) => (
            <div
              key={item.label}
              id={`${menuId}-${i}`}
              // biome-ignore lint/a11y/useSemanticElements: option of the custom listbox above
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={-1}
              // mousedown, not click: keep focus (and the caret) in the textarea.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                i === activeIndex && "bg-accent",
              )}
            >
              {item.type === "command" ? (
                <CommandRow kind={item.kind} label={item.label} hint={item.hint} />
              ) : (
                <>
                  <span aria-hidden className="text-base">
                    {item.emotion.emoji}
                  </span>
                  <span>{capitalizeFirst(item.label)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t(`journal.valence.${item.emotion.valence}`)}
                  </span>
                </>
              )}
            </div>
          ))}
          <p className="border-t px-2 pt-1.5 pb-0.5 text-[11px] text-muted-foreground">
            {t("journal.composer.menuHelp")}
          </p>
        </div>
      )}
    </div>
  );
}

function CommandRow({
  kind,
  label,
  hint,
}: { kind: keyof typeof KIND_BY_ID; label: string; hint: string }) {
  const config = KIND_BY_ID[kind];
  const Icon = config.icon;
  return (
    <>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          config.dotClass,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="font-medium">/{label}</span>
      <span className="ml-auto truncate text-xs text-muted-foreground">{hint}</span>
    </>
  );
}
