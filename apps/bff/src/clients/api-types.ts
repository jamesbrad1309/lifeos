/**
 * JSON shapes returned by apps/api's REST endpoints. They're declared here
 * rather than imported from the API package because this is a network
 * contract: the BFF must not depend on the API's Prisma-generated types or
 * build output. Dates arrive as ISO strings; entry dates as "YYYY-MM-DD".
 */

export interface ApiHabit {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  unit: string | null;
  targetValue: number | null;
  startTime: string | null;
  schedule: unknown;
  metadata: Record<string, unknown>;
  archivedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiHabitEntry {
  id: string;
  habitId: string;
  date: string;
  value: number | null;
  completed: boolean;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiHabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  points: number;
  level: number;
  levelTitle: string;
  heatmap: { date: string; completed: boolean; value: number | null }[];
}

export interface ApiDashboardStats {
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

export type ApiJournalEntryKind = "ACTION" | "FEELING" | "EVENT";

export interface ApiJournalEntry {
  id: string;
  date: string;
  kind: ApiJournalEntryKind;
  time: string | null;
  text: string;
  tags: string[];
  durationMinutes: number | null;
  emotion: string | null;
  intensity: number | null;
  tone: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  triggerId: string | null;
  /** Just enough of the triggering EVENT to render "because of …". */
  trigger: { id: string; kind: ApiJournalEntryKind; text: string; time: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiJournalDaySummary {
  date: string;
  actionCount: number;
  feelingCount: number;
  eventCount: number;
  emotions: string[];
}

export type ApiAccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "IOU"
  | "CASH"
  | "INVESTMENT";

/** Amounts in minor units; `@db.Date` columns as "YYYY-MM-DD". */
export interface ApiAccount {
  id: string;
  name: string;
  type: ApiAccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  openingBalanceMinor: number;
  openingBalanceDate: string;
  lastReconciledAt: string | null;
  creditLimitMinor: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  minPaymentMinor: number | null;
  aprBps: number | null;
  monthlyPaymentMinor: number | null;
  loanStartDate: string | null;
  termMonths: number | null;
  dueDate: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** `GET /accounts/balances`: the balance plus derived card/loan values, null where n/a. */
export interface ApiAccountMetrics {
  accountId: string;
  balanceMinor: number;
  balanceMainMinor: number | null;
  availableCreditMinor: number | null;
  utilization: number | null;
  nextDueDate: string | null;
  currentStatementSpendMinor: number | null;
  estimatedPayoffMonth: string | null;
  paymentCoversInterest: boolean | null;
}

export interface ApiNetWorth {
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
}

export interface ApiCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: string;
  parentId: string | null;
  archivedAt: string | null;
  isSystem: boolean;
  metadata: { key?: string; aliases?: string[]; dismissedPresetSuggestions?: string[] };
  sortOrder: number;
  createdAt: string;
}

/** `date` as "YYYY-MM-DD". */
export interface ApiTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  date: string;
  amountMinor: number;
  payee: string | null;
  note: string | null;
  tags: string[];
  transferId: string | null;
  importHash: string | null;
  clientId: string | null;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTransactionPage {
  items: ApiTransaction[];
  nextCursor: string | null;
}

export interface ApiQuickPreset {
  id: string;
  label: string;
  emoji: string | null;
  amountMinor: number | null;
  categoryId: string;
  accountId: string | null;
  payee: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ApiQuickLogContext {
  defaultAccountId: string | null;
  suggestedCategories: ApiCategory[];
  presets: ApiQuickPreset[];
  recentPayees: { payee: string; categoryId: string | null }[];
  toReviewCount: number;
  lastAccountByCategory: Record<string, string>;
}

export interface ApiQuickLogResult {
  transaction: ApiTransaction;
  suggestPreset: boolean;
  presetKey: string | null;
}
