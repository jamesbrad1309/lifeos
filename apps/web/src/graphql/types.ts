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
