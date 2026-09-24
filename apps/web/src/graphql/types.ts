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
