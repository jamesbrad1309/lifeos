export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekly"; daysOfWeek: number[] }
  | { type: "timesPerWeek"; count: number }
  | { type: "interval"; everyNDays: number };

export interface HabitEntry {
  id: string;
  value: number | null;
  completed: boolean;
}

export interface HeatmapDay {
  date: string;
  completed: boolean;
  value: number | null;
}

export interface Habit {
  id: string;
  name: string;
  icon: string | null;
  unit: string | null;
  targetValue: number | null;
  /** "HH:mm" (24h), or null for "anytime today" — see components/DayCalendar.tsx. */
  startTime: string | null;
  schedule: HabitSchedule;
  paused: boolean;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  points: number;
  level: number;
  levelTitle: string;
  todayEntry: HabitEntry | null;
  heatmap: HeatmapDay[];
}

export interface HabitsData {
  habits: Habit[];
}

export interface DashboardStats {
  totalHabits: number;
  pausedHabits: number;
  totalPoints: number;
  level: number;
  levelTitle: string;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  longestOverallStreak: number;
  activeStreakCount: number;
}

export interface DashboardStatsData {
  dashboardStats: DashboardStats;
}

export interface CreateHabitInput {
  name: string;
  icon?: string;
  unit?: string;
  targetValue?: number;
  startTime?: string;
  schedule: HabitSchedule;
}

export interface UpdateHabitInput {
  name?: string;
  icon?: string | null;
  unit?: string | null;
  targetValue?: number | null;
  startTime?: string | null;
  schedule?: HabitSchedule;
}

export type JournalEntryKind = "ACTION" | "FEELING" | "EVENT";
export type JournalTone = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface JournalTrigger {
  id: string;
  kind: JournalEntryKind;
  text: string;
  time: string | null;
}

export interface JournalEntry {
  id: string;
  date: string;
  kind: JournalEntryKind;
  /** "HH:mm" (24h), or null for "sometime that day". */
  time: string | null;
  text: string;
  tags: string[];
  durationMinutes: number | null;
  emotion: string | null;
  intensity: number | null;
  tone: JournalTone | null;
  trigger: JournalTrigger | null;
}

export interface JournalEntriesData {
  journalEntries: JournalEntry[];
}

export interface JournalDay {
  date: string;
  actionCount: number;
  feelingCount: number;
  eventCount: number;
  emotions: string[];
}

export interface JournalDaysData {
  journalDays: JournalDay[];
}

/** Full replacement — see JournalEntryInput in the BFF schema for per-kind rules. */
export interface JournalEntryInput {
  date: string;
  kind: JournalEntryKind;
  time: string | null;
  text: string;
  durationMinutes?: number | null;
  emotion?: string | null;
  intensity?: number | null;
  tone?: JournalTone | null;
  triggerId?: string | null;
}

/** One item of a composer list; `triggerIndex` points at an EVENT earlier in the same list. */
export interface JournalEntryDraft extends JournalEntryInput {
  triggerIndex?: number;
}

export type AccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "IOU"
  | "CASH"
  | "INVESTMENT";

/** Amounts are integer minor units; format them with lib/money.ts. Negative balance = owed. */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  sortOrder: number;
  isDefault: boolean;
  /** "YYYY-MM-DD" */
  openingBalanceDate: string;
  /** ISO timestamp */
  lastReconciledAt: string | null;
  /** In the account's own `currency`. */
  balanceMinor: number;
  /** In the main currency at today's rate; null without a rate. */
  balanceMainMinor: number | null;
  creditLimitMinor: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  minPaymentMinor: number | null;
  availableCreditMinor: number | null;
  utilization: number | null;
  nextDueDate: string | null;
  currentStatementSpendMinor: number | null;
  aprBps: number | null;
  monthlyPaymentMinor: number | null;
  loanStartDate: string | null;
  termMonths: number | null;
  /** "YYYY-MM" */
  estimatedPayoffMonth: string | null;
  paymentCoversInterest: boolean | null;
  dueDate: string | null;
  archivedAt: string | null;
}

export interface NetWorth {
  /** The main currency. */
  currency: string;
  /** Currencies left out for want of a rate. */
  unconverted: string[];
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
}

export interface AccountsData {
  accounts: Account[];
  archivedAccounts: Account[];
  netWorth: NetWorth;
}

export interface Category {
  id: string;
  name: string;
  /** An emoji. */
  icon: string | null;
  kind: "expense" | "income" | string;
  /** Lowercase words the quick-log parser also matches. */
  aliases: string[];
  /** Seeded categories: translate the name by this (see useCategoryName). Null for the user's own. */
  key: string | null;
}

export interface Transaction {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Negative = money out. */
  amountMinor: number;
  payee: string | null;
  note: string | null;
  /** quick | form | import | recurring | adjustment */
  source: string;
  isTransfer: boolean;
  /** For a transfer: the other account. */
  transferAccount: Pick<Account, "id" | "name" | "currency"> | null;
  createdAt: string;
  account: Pick<Account, "id" | "name" | "currency">;
  category: Category | null;
}

export interface TransactionFilter {
  accountId?: string | null;
  categoryId?: string | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
  includeTransfers?: boolean;
  uncategorisedOnly?: boolean;
}

export interface TransactionsData {
  transactions: { items: Transaction[]; nextCursor: string | null };
}

export interface QuickPreset {
  id: string;
  label: string;
  emoji: string | null;
  amountMinor: number | null;
  payee: string | null;
  category: Category;
  account: { id: string } | null;
}

export type QuickLogAccount = Pick<Account, "id" | "name" | "type" | "currency" | "last4">;

export interface QuickLogContext {
  defaultAccount: { id: string } | null;
  accounts: QuickLogAccount[];
  suggestedCategories: Category[];
  presets: QuickPreset[];
  recentPayees: { payee: string; category: { id: string } | null }[];
  toReviewCount: number;
  lastAccountByCategory: Record<string, string>;
}

export interface QuickLogData {
  quickLog: { transaction: Transaction; suggestPreset: boolean; presetKey: string | null };
}

export interface CategorySpend {
  /** Null: uncategorised. */
  category: Category | null;
  /** Out minus refunds; negative when refunds won. */
  spentMinor: number;
  previousSpentMinor: number;
  transactionCount: number;
}

export interface SpendReport {
  month: string;
  currency: string;
  unconverted: string[];
  spentMinor: number;
  previousSpentMinor: number;
  incomeMinor: number;
  categories: CategorySpend[];
}

export type BudgetPace = "ON_TRACK" | "CLOSE" | "OVER";

export interface BudgetLine {
  category: Category;
  limitMinor: number;
  carriedMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  rollover: boolean;
  /** "YYYY-MM" the limit was last set. */
  since: string;
  pace: BudgetPace;
  averageSpentMinor: number;
}

export interface BudgetReport {
  month: string;
  currency: string;
  unconverted: string[];
  monthProgress: number;
  totals: { availableMinor: number; spentMinor: number; remainingMinor: number };
  lines: BudgetLine[];
  unbudgeted: { category: Category | null; spentMinor: number; averageSpentMinor: number }[];
}

export interface CurrencySetting {
  code: string;
  isMain: boolean;
  /** Main-currency units per 1 unit, set by the user. */
  overrideToMain: number | null;
  marketRateToMain: number | null;
  /** What conversions use: the override, else the market rate. */
  rateToMain: number | null;
  accountCount: number;
}

export interface CurrencySettingsData {
  currencySettings: {
    currencies: CurrencySetting[];
    rates: {
      date: string;
      source: string;
      fetchedAt: string;
      attribution: { label: string; url: string };
    } | null;
  };
}

export type ImportRowStatus = "NEW" | "DUPLICATE" | "MATCHED" | "BEFORE_OPENING";

export type CsvDateFormat =
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "DD-MM-YYYY"
  | "DD.MM.YYYY";

/** How a bank CSV's columns map onto transactions; the API validates it (csvMappingSchema). */
export interface CsvMapping {
  hasHeader: boolean;
  dateColumn: number;
  dateFormat: CsvDateFormat;
  amount:
    | { mode: "single"; column: number; invert: boolean }
    | { mode: "split"; debitColumn: number; creditColumn: number };
  payeeColumn: number | null;
  noteColumn: number | null;
}

/** What `POST /uploads/transactions-csv` answers: the server has the file now. */
export interface CsvUpload {
  id: string;
  rowCount: number;
  headers: string[];
  sample: string[][];
  mapping: CsvMapping;
}

export interface CsvImportPreview {
  currency: string;
  total: number;
  new: number;
  duplicates: number;
  matched: number;
  beforeOpening: number;
  rows: {
    line: number;
    date: string;
    amountMinor: number;
    payee: string | null;
    note: string | null;
    status: ImportRowStatus;
    category: Category | null;
  }[];
  problems: { line: number; reason: "date" | "amount"; value: string }[];
}
