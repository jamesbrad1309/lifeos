import type { JournalEntry, JournalEntryKind, JournalTone } from "#graphql/types";
import { journal as en } from "#i18n/en/journal";
import { journal as vi } from "#i18n/vi/journal";
import { EMOTIONS, type Emotion, emotionFor } from "#lib/emotions";

/** The languages the syntax is written in. Every language's words parse; this picks which to write. */
export type SyntaxLanguage = "en" | "vi";
const WORDS = { en, vi } as const;

/** Case, accents and spacing don't matter: "/Sự-kiện", "/sukien" and "/sựkiện" are one command. */
function fold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();
}

/**
 * The composer's plain-text format: one entry per bulleted line, starting
 * with a slash command, plus optional inline tokens.
 *
 *   - /event Client moved the deadline (-) @09:30 #work
 *     - /feeling stressed 4/5 not sure we can ship
 *     - /action rewrote the plan 45m
 *   - /action went for a walk 20m
 *
 * An item indented under an /event is linked to it as its trigger. A line
 * with no bullet or command continues the previous item's text.
 */

const KINDS: JournalEntryKind[] = ["ACTION", "FEELING", "EVENT"];

/** The slash word for `kind` in `language`: "/action", or "/làm" in Vietnamese. */
export function commandFor(kind: JournalEntryKind, language: SyntaxLanguage = "en"): string {
  return WORDS[language].commands[kind];
}

/**
 * Accepted spellings, folded: each language's command, the composer's old
 * English labels, and first letters.
 */
const KIND_BY_WORD: Record<string, JournalEntryKind> = {
  did: "ACTION",
  a: "ACTION",
  felt: "FEELING",
  f: "FEELING",
  happened: "EVENT",
  e: "EVENT",
  ...Object.fromEntries(
    Object.values(WORDS).flatMap((words) =>
      KINDS.map((kind) => [fold(words.commands[kind]).replace(/[\s-]/g, ""), kind]),
    ),
  ),
};

function kindForWord(word: string): JournalEntryKind | undefined {
  return KIND_BY_WORD[fold(word).replace(/[\s-]/g, "")];
}

/**
 * Emotion phrases in every language, folded, to the key that's stored
 * ("lo âu" → "anxious"). Longest first, so "tràn đầy năng lượng" wins over
 * a shorter phrase that starts the same way.
 */
const EMOTION_PHRASES: [string[], string][] = EMOTIONS.flatMap(({ name }) => {
  const phrases = new Set([
    name,
    ...Object.values(WORDS).map((w) => w.emotions[name as keyof typeof en.emotions]),
  ]);
  return [...phrases].filter(Boolean).map((p): [string[], string] => [fold(p).split(/\s+/), name]);
}).sort((a, b) => b[0].length - a[0].length);

/** The emotion at the start of `text` (known phrase, else its first word) and the rest. */
function takeEmotion(text: string): [string | null, string] {
  const words = tidy(text).split(" ").filter(Boolean);
  const folded = words.map((w) => fold(w.replace(/[.,;:!?]+$/, "")));
  for (const [phrase, key] of EMOTION_PHRASES) {
    if (phrase.every((w, i) => folded[i] === w)) return [key, words.slice(phrase.length).join(" ")];
  }
  const [first = "", ...others] = words;
  return [first.replace(/[.,;:!?]+$/, "").toLowerCase() || null, others.join(" ")];
}

/** A word's name in `language`: stored keys are English, known ones get translated. */
export function emotionName(key: string, language: SyntaxLanguage = "en"): string {
  return WORDS[language].emotions[key as keyof typeof en.emotions] ?? key;
}

const TONE_BY_TOKEN: Record<string, JournalTone> = {
  "+": "POSITIVE",
  "=": "NEUTRAL",
  "~": "NEUTRAL",
  "-": "NEGATIVE",
};
const TOKEN_BY_TONE: Record<JournalTone, string> = { POSITIVE: "+", NEUTRAL: "=", NEGATIVE: "-" };

export interface ParsedItem {
  /** 0-based line the item starts on, for pointing at problems. */
  line: number;
  indent: number;
  kind: JournalEntryKind;
  text: string;
  time: string | null;
  durationMinutes: number | null;
  emotion: string | null;
  intensity: number | null;
  tone: JournalTone | null;
  /** Index (into `items`) of the /event this item is nested under. */
  triggerIndex: number | null;
}

/** Why a line didn't parse; the UI words it (`journal.issues.<code>`). */
export type ParseIssueCode =
  | "invalidTime"
  | "actionNeedsText"
  | "feelingNeedsEmotion"
  | "eventNeedsText"
  | "needsCommand"
  | "unknownCommand"
  | "pickCommand";

export interface ParseIssue {
  line: number;
  code: ParseIssueCode;
  /** Values for the message: the bad token, the command word that was used. */
  params?: Record<string, string>;
}

export interface ParseResult {
  items: ParsedItem[];
  issues: ParseIssue[];
}

const LINE = /^(\s*)([-*•]\s+)?(?:\/(\S*))?\s*(.*)$/;
const END = "(?=\\s|$|[.,;!?])";
const TIME_TOKEN = new RegExp(`(?:^|\\s)@(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?${END}`, "i");
const DURATION_TOKEN = new RegExp(
  `(?:^|\\s)(?=\\d)(?:(\\d+)h)?(?:(\\d+)\\s?m(?:ins?)?)?${END}`,
  "i",
);
const INTENSITY_TOKEN = new RegExp(`(?:^|\\s)([1-5])/5${END}`);
const TONE_TOKEN = /(?:^|\s)\(([+=~-])\)(?=\s|$)/;

/** Removes the first match of `pattern` from `text`; returns the match (if any) and the rest. */
function take(text: string, pattern: RegExp): [RegExpExecArray | null, string] {
  const match = pattern.exec(text);
  if (!match || match[0].trim() === "") return [null, text];
  return [match, `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`];
}

function tidy(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function parseTime(match: RegExpExecArray): string | null {
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseLine(
  kind: JournalEntryKind,
  word: string,
  rest: string,
  line: number,
  issues: ParseIssue[],
) {
  let text = rest;
  let time: string | null = null;
  let durationMinutes: number | null = null;
  let emotion: string | null = null;
  let intensity: number | null = null;
  let tone: JournalTone | null = null;

  const [timeMatch, afterTime] = take(text, TIME_TOKEN);
  if (timeMatch) {
    time = parseTime(timeMatch);
    if (time === null)
      issues.push({ line, code: "invalidTime", params: { token: timeMatch[0].trim() } });
    text = afterTime;
  }

  if (kind === "ACTION") {
    const [match, after] = take(text, DURATION_TOKEN);
    if (match) {
      const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
      if (minutes >= 1 && minutes <= 1440) {
        durationMinutes = minutes;
        text = after;
      }
    }
    if (tidy(text) === "")
      issues.push({ line, code: "actionNeedsText", params: { command: word } });
  }

  if (kind === "FEELING") {
    const [match, after] = take(text, INTENSITY_TOKEN);
    if (match) {
      intensity = Number(match[1]);
      text = after;
    }
    [emotion, text] = takeEmotion(text);
    if (!emotion) issues.push({ line, code: "feelingNeedsEmotion", params: { command: word } });
    intensity ??= 3;
  }

  if (kind === "EVENT") {
    const [match, after] = take(text, TONE_TOKEN);
    if (match) {
      tone = TONE_BY_TOKEN[match[1]];
      text = after;
    }
    if (tidy(text) === "") issues.push({ line, code: "eventNeedsText", params: { command: word } });
  }

  return { text: tidy(text), time, durationMinutes, emotion, intensity, tone };
}

export function parseJournalText(source: string): ParseResult {
  const items: ParsedItem[] = [];
  const issues: ParseIssue[] = [];
  /** Open ancestors, innermost last — decides what an indented item is nested under. */
  const stack: { indent: number; index: number }[] = [];

  source.split("\n").forEach((raw, line) => {
    const match = LINE.exec(raw.replace(/\t/g, "  "));
    if (!match) return;
    const [, spaces, bullet, word, rest] = match;
    if (word === undefined && rest.trim() === "") return; // blank line or a bare bullet

    if (word === undefined) {
      const previous = items.at(-1);
      if (!bullet && previous) {
        previous.text = tidy(`${previous.text}\n${rest}`);
      } else {
        issues.push({ line, code: "needsCommand" });
      }
      return;
    }

    const kind = kindForWord(word);
    if (!kind) {
      issues.push(
        word ? { line, code: "unknownCommand", params: { word } } : { line, code: "pickCommand" },
      );
      return;
    }

    const indent = spaces.length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack.at(-1);
    const triggerIndex =
      parent && kind !== "EVENT" && items[parent.index].kind === "EVENT" ? parent.index : null;

    stack.push({ indent, index: items.length });
    items.push({ line, indent, kind, triggerIndex, ...parseLine(kind, word, rest, line, issues) });
  });

  return { items, issues };
}

function formatDurationToken(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h ? `${h}h` : ""}${m ? `${m}m` : ""}`;
}

/** One line of composer syntax for an existing entry — what "edit" opens with, in `language`. */
export function serializeEntry(entry: JournalEntry, language: SyntaxLanguage = "en"): string {
  const parts = [`/${commandFor(entry.kind, language)}`];
  if (entry.kind === "FEELING" && entry.emotion) {
    parts.push(emotionName(entry.emotion, language));
    if (entry.intensity) parts.push(`${entry.intensity}/5`);
  }
  if (entry.text) parts.push(entry.text);
  if (entry.durationMinutes) parts.push(formatDurationToken(entry.durationMinutes));
  if (entry.tone) parts.push(`(${TOKEN_BY_TONE[entry.tone]})`);
  if (entry.time) parts.push(`@${entry.time}`);
  return parts.join(" ");
}

export type Suggestion =
  | { type: "command"; label: string; hint: string; kind: JournalEntryKind; insert: string }
  | { type: "emotion"; label: string; emotion: Emotion; insert: string };

export interface SuggestionState {
  /** Range of `value` a chosen suggestion replaces. */
  from: number;
  to: number;
  items: Suggestion[];
}

const COMMAND_PREFIX = /^(\s*(?:[-*•]\s+)?)\/([\p{L}-]*)$/u;
const EMOTION_PREFIX = /^\s*(?:[-*•]\s+)?\/(\S+)\s+([\p{L} ]*)$/u;

/**
 * What the slash menu should offer at `caret`: commands right after a `/`
 * at the start of an item, or emotion words right after `/feeling `.
 */
export function suggestionsAt(
  value: string,
  caret: number,
  language: SyntaxLanguage = "en",
): SuggestionState | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const before = value.slice(lineStart, caret);

  const command = COMMAND_PREFIX.exec(before);
  if (command) {
    const query = fold(command[2]).replace(/-/g, "");
    const items: Suggestion[] = KINDS.filter((kind) =>
      Object.entries(KIND_BY_WORD).some(([w, k]) => k === kind && w.startsWith(query)),
    ).map((kind) => ({
      type: "command",
      label: commandFor(kind, language),
      hint: WORDS[language].kinds[kind].hint,
      kind,
      insert: `/${commandFor(kind, language)} `,
    }));
    return items.length > 0 ? { from: lineStart + command[1].length, to: caret, items } : null;
  }

  const feeling = EMOTION_PREFIX.exec(before);
  if (feeling && kindForWord(feeling[1]) === "FEELING") {
    const typed = feeling[2];
    const query = fold(typed);
    const items: Suggestion[] = EMOTIONS.map((e) => ({ e, label: emotionName(e.name, language) }))
      .filter(({ e, label }) => fold(label).startsWith(query) || e.name.startsWith(query))
      .filter(({ label }) => fold(label) !== query)
      .slice(0, 8)
      .map(({ e, label }) => ({
        type: "emotion",
        label,
        emotion: emotionFor(e.name),
        insert: `${label} `,
      }));
    return items.length > 0 ? { from: caret - typed.length, to: caret, items } : null;
  }

  return null;
}
