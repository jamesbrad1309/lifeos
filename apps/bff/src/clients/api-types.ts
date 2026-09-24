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
