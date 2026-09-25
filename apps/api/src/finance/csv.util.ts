import { currencyDigits } from "#finance/currency-math.util";
import type { CsvMapping } from "#finance/dto/import.dto";

/**
 * Turning a bank's CSV (split into cells by csv-parse) into transactions:
 * guessing the column mapping, parsing dates and signed amounts. Pure, so
 * every bank quirk can be a test case.
 */

export type { CsvMapping };

/**
 * A typed number → "1234.5", whichever convention it used: the last "." or
 * "," is the decimal point when 1–`maxFraction` digits follow it; any other
 * separator must group thousands ("1.204,33", "1,204.33").
 */
function normalizeNumber(input: string, maxFraction: number): string | null {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  if (!/^\d[\d.,]*$|^[.,]\d+$/.test(cleaned)) return null;
  const last = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  const fraction = last === -1 ? "" : cleaned.slice(last + 1);
  const isDecimal = last !== -1 && fraction.length >= 1 && fraction.length <= maxFraction;
  const grouped = isDecimal ? cleaned.slice(0, last) : cleaned;
  if (/[.,]/.test(grouped) && !/^\d{1,3}([.,]\d{3})+$/.test(grouped)) return null;
  const whole = grouped.replace(/[.,]/g, "");
  return isDecimal ? `${whole || "0"}.${fraction}` : whole;
}

/** An unsigned amount → minor units of `currency`, or null. */
function parseUnsigned(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const normalized = normalizeNumber(input.trim(), Math.max(digits, 2));
  if (normalized === null || normalized === "") return null;
  const [, fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  return Math.round(Number.parseFloat(normalized) * 10 ** digits);
}

/** Y, M, D → "YYYY-MM-DD" (UTC, no time-zone shifts). */
function isoOf(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export type DateFormat = CsvMapping["dateFormat"];
export const DATE_FORMATS: DateFormat[] = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "DD.MM.YYYY",
];

export interface CsvRow {
  /** 1-based line in the file, for pointing at problems. */
  line: number;
  date: string;
  /** Signed minor units: negative = money out. */
  amountMinor: number;
  payee: string | null;
  note: string | null;
}

export interface CsvProblem {
  line: number;
  reason: "date" | "amount";
  value: string;
}

/** "31/12/2026" in `format` → "2026-12-31", or null if it isn't a real date. */
export function parseCsvDate(text: string, format: DateFormat): string | null {
  const parts = text
    .trim()
    .split(/[/.\-\s]+/)
    .map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  const [a, b, c] = parts;
  const [y, m, d] =
    format === "YYYY-MM-DD" ? [a, b, c] : format === "MM/DD/YYYY" ? [c, a, b] : [c, b, a];
  return isoOf(y < 100 ? 2000 + y : y, m, d);
}

/**
 * A bank's amount cell → signed minor units. Understands "-12.50",
 * "(12.50)", "12.50-", "£1,234.50", "1.234,50" and "12.50 DR"/"CR".
 * Blank or unreadable → null.
 */
export function parseSignedAmount(text: string, currency: string): number | null {
  let value = text.trim();
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (/\bDR$/i.test(value)) {
    negative = true;
    value = value.replace(/\s*DR$/i, "");
  }
  value = value.replace(/\s*CR$/i, "");
  if (/^[^\d]*-/.test(value) || value.endsWith("-")) {
    negative = !negative;
    value = value.replace(/-/g, "");
  }
  if (value.startsWith("+")) value = value.slice(1);
  const minor = parseUnsigned(value, currency);
  return minor === null ? null : negative ? -minor : minor;
}

const HEADER_HINTS = {
  date: /^(transaction |posting |posted |value )?date$|^ngày|^ngay|^date/i,
  payee:
    /description|payee|merchant|name|details|narrative|nội dung|noi dung|diễn giải|dien giai|mô tả|mo ta/i,
  amount: /^amount|^value$|số tiền|so tien|^sum/i,
  debit: /debit|paid out|money out|withdrawal|ghi nợ|ghi no|^out$/i,
  credit: /credit|paid in|money in|deposit|ghi có|ghi co|^in$/i,
  note: /reference|memo|note|ref$|mã giao dịch|ghi chú|ghi chu/i,
};

function findColumn(headers: string[], pattern: RegExp, taken: Set<number>): number | null {
  const index = headers.findIndex((h, i) => !taken.has(i) && pattern.test(h.trim()));
  return index === -1 ? null : index;
}

/**
 * Picks a date format that parses every sample. When a value has a day
 * above 12 the order is settled; otherwise `preferDayFirst` (UK and Vietnam
 * write day first) breaks the tie. The UI shows the guess to confirm.
 */
export function guessDateFormat(samples: string[], preferDayFirst = true): DateFormat {
  const order: DateFormat[] = preferDayFirst
    ? ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]
    : ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"];
  const values = samples.map((s) => s.trim()).filter(Boolean);
  const separator = values[0]?.match(/[/.-]/)?.[0];
  const candidates = order.map((f) =>
    f === "DD/MM/YYYY" && separator === "-"
      ? "DD-MM-YYYY"
      : f === "DD/MM/YYYY" && separator === "."
        ? "DD.MM.YYYY"
        : f,
  ) as DateFormat[];
  return candidates.find((f) => values.every((v) => parseCsvDate(v, f) !== null)) ?? candidates[1];
}

/** A first guess at the mapping from the header row and a few data rows. */
export function guessMapping(records: string[][], preferDayFirst = true): CsvMapping {
  const first = records[0] ?? [];
  const hasHeader =
    first.some((cell) => /[a-zA-ZÀ-ỹ]{3}/.test(cell)) &&
    !first.some((c) => parseCsvDate(c, "YYYY-MM-DD") || parseCsvDate(c, "DD/MM/YYYY"));
  const headers = hasHeader ? first : first.map(() => "");
  const data = records.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 20);
  const taken = new Set<number>();
  const take = (i: number | null) => {
    if (i !== null) taken.add(i);
    return i;
  };

  const dateColumn =
    take(findColumn(headers, HEADER_HINTS.date, taken)) ??
    take(
      first.findIndex(
        (_, i) =>
          data.length > 0 && data.every((r) => /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(r[i] ?? "")),
      ),
    ) ??
    0;
  const debit = take(findColumn(headers, HEADER_HINTS.debit, taken));
  const credit = debit !== null ? take(findColumn(headers, HEADER_HINTS.credit, taken)) : null;
  const amountColumn =
    debit !== null && credit !== null
      ? null
      : (take(findColumn(headers, HEADER_HINTS.amount, taken)) ??
        take(
          first.findIndex(
            (_, i) =>
              !taken.has(i) &&
              data.length > 0 &&
              data.every((r) => parseSignedAmount(r[i] ?? "", "GBP") !== null),
          ),
        ));
  const payeeColumn = take(findColumn(headers, HEADER_HINTS.payee, taken));
  const noteColumn = take(findColumn(headers, HEADER_HINTS.note, taken));

  return {
    hasHeader,
    dateColumn: dateColumn === -1 ? 0 : dateColumn,
    dateFormat: guessDateFormat(
      data.map((r) => r[dateColumn] ?? ""),
      preferDayFirst,
    ),
    amount:
      debit !== null && credit !== null
        ? { mode: "split", debitColumn: debit, creditColumn: credit }
        : {
            mode: "single",
            column: amountColumn === null || amountColumn === -1 ? 1 : amountColumn,
            invert: false,
          },
    payeeColumn,
    noteColumn,
  };
}

/** Applies a mapping: rows ready to send, and the lines that couldn't be read. */
export function applyMapping(
  records: string[][],
  mapping: CsvMapping,
  currency: string,
): { rows: CsvRow[]; problems: CsvProblem[] } {
  const rows: CsvRow[] = [];
  const problems: CsvProblem[] = [];
  records.forEach((record, i) => {
    if (mapping.hasHeader && i === 0) return;
    if (record.every((cell) => cell.trim() === "")) return;
    const line = i + 1;
    const dateText = record[mapping.dateColumn] ?? "";
    const date = parseCsvDate(dateText, mapping.dateFormat);
    if (!date) return problems.push({ line, reason: "date", value: dateText });

    let amountMinor: number | null;
    if (mapping.amount.mode === "single") {
      const parsed = parseSignedAmount(record[mapping.amount.column] ?? "", currency);
      amountMinor = parsed === null ? null : mapping.amount.invert ? -parsed : parsed;
    } else {
      // Debit and credit columns hold positive numbers; one of them is blank.
      const debit = parseSignedAmount(record[mapping.amount.debitColumn] ?? "", currency);
      const credit = parseSignedAmount(record[mapping.amount.creditColumn] ?? "", currency);
      amountMinor =
        debit || credit ? (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0) : null;
    }
    if (!amountMinor) {
      const raw =
        mapping.amount.mode === "single"
          ? record[mapping.amount.column]
          : record[mapping.amount.debitColumn];
      return problems.push({ line, reason: "amount", value: raw ?? "" });
    }

    const cell = (column: number | null) =>
      column === null ? null : record[column]?.trim() || null;
    rows.push({
      line,
      date,
      amountMinor,
      payee: cell(mapping.payeeColumn),
      note: cell(mapping.noteColumn),
    });
  });
  return { rows, problems };
}
