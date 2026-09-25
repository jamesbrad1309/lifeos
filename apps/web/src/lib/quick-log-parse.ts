import { parseMoneyInput } from "#lib/money";

/**
 * Quick log's one-line parser: "3.4 coffee", "lunch 12.50 @amex",
 * "tesco 23.10". Pure and synchronous: it runs on every keystroke to
 * preview which chip it will pick (docs/finance/quick-log-implementation.md).
 */

export interface ParseContext {
  categories: { id: string; name: string; kind: string; aliases: string[] }[];
  presets: {
    id: string;
    label: string;
    amountMinor: number | null;
    payee: string | null;
    category: { id: string };
  }[];
  accounts: { id: string; name: string }[];
  /** Newest first, with the category each was last logged under. */
  payees: { payee: string; categoryId: string | null }[];
  currency?: string;
}

export interface ParsedLog {
  amountMinor: number | null;
  categoryId: string | null;
  /** Why that category: shown as a hint under the field. */
  matchedBy: "preset" | "category" | "payee" | null;
  presetId: string | null;
  accountId: string | null;
  payee: string | null;
  /** Whatever wasn't recognised. */
  note: string | null;
}

const EMPTY: ParsedLog = {
  amountMinor: null,
  categoryId: null,
  matchedBy: null,
  presetId: null,
  accountId: null,
  payee: null,
  note: null,
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    // NFKD splits "é" into "e" + a combining accent; drop the accents.
    .replace(/\p{M}/gu, "")
    // NFKD leaves Vietnamese đ intact (it's a stroke, not an accent), so
    // "di cho" typed without diacritics matches "đi chợ".
    .replace(/đ/g, "d")
    // "Sainsbury's" and "sainsburys" are the same shop.
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "12.50", "£3", "3,40" (a decimal comma, when followed by exactly two digits). */
const AMOUNT = /^[£$€]?\d+(?:[.,]\d{1,2})?$/;

/** Does `phrase` contain `term` as whole words? Both already normalized. */
function hasWords(phrase: string, term: string): boolean {
  return term !== "" && ` ${phrase} `.includes(` ${term} `);
}

function removeWords(phrase: string, term: string): string {
  return ` ${phrase} `.replace(` ${term} `, " ").trim();
}

export function parseQuickLog(text: string, ctx: ParseContext): ParsedLog {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return EMPTY;

  const result: ParsedLog = { ...EMPTY };
  const words: string[] = [];

  for (const token of tokens) {
    if (result.amountMinor === null && AMOUNT.test(token)) {
      const decimal = token.replace(/,(\d{1,2})$/, ".$1");
      result.amountMinor = parseMoneyInput(decimal, ctx.currency);
      continue;
    }
    if (token.startsWith("@") && token.length > 1 && result.accountId === null) {
      const wanted = normalize(token.slice(1)).replace(/ /g, "");
      const account =
        ctx.accounts.find((a) => normalize(a.name).replace(/ /g, "").startsWith(wanted)) ??
        ctx.accounts.find((a) => normalize(a.name).replace(/ /g, "").includes(wanted));
      if (account) {
        result.accountId = account.id;
        continue;
      }
    }
    words.push(token);
  }

  let phrase = normalize(words.join(" "));
  const original = words.join(" ");

  // 1. Presets: "flat white" → its category, amount and payee.
  const preset = [...ctx.presets]
    .sort((a, b) => b.label.length - a.label.length)
    .find((p) => hasWords(phrase, normalize(p.label)));
  if (preset) {
    result.categoryId = preset.category.id;
    result.matchedBy = "preset";
    result.presetId = preset.id;
    result.amountMinor ??= preset.amountMinor;
    result.payee = preset.payee;
    phrase = removeWords(phrase, normalize(preset.label));
  }

  // 2. A payee seen before, e.g. "tesco": remembered with its last category.
  const payee = ctx.payees.find((p) => {
    const name = normalize(p.payee);
    return name !== "" && hasWords(phrase, name);
  });
  if (payee) {
    result.payee ??= payee.payee;
    if (!result.categoryId && payee.categoryId) {
      result.categoryId = payee.categoryId;
      result.matchedBy = "payee";
    }
    phrase = removeWords(phrase, normalize(payee.payee));
  }

  // 3. Category names and aliases, longest first ("flat white" before "white").
  if (!result.categoryId) {
    const terms = ctx.categories
      .flatMap((c) =>
        [c.name, ...c.aliases].map((term) => ({ term: normalize(term), category: c })),
      )
      .filter((t) => t.term !== "")
      .sort((a, b) => b.term.length - a.term.length);
    const hit = terms.find((t) => hasWords(phrase, t.term));
    if (hit) {
      result.categoryId = hit.category.id;
      result.matchedBy = "category";
      // The category's own name says nothing new ("coffee"); an alias
      // ("latte", "lunch") does, so it stays in the note.
      if (hit.term === normalize(hit.category.name)) phrase = removeWords(phrase, hit.term);
    }
  }

  // Whatever's left keeps the user's own spelling and capitals.
  if (phrase) {
    const kept = original
      .split(/\s+/)
      .filter((w) => phrase.split(" ").includes(normalize(w)))
      .join(" ");
    result.note = kept || phrase;
  }
  return result;
}
