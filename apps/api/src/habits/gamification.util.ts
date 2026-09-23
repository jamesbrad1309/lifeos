/**
 * Deliberately simple, deliberately server-side: points and level are
 * derived here (never stored — see "Derived data" in
 * docs/domain/habit-data-model.md) so the frontend never re-implements the
 * formula and can't drift from it.
 *
 * 10 points per successful check-in, +5 per day of current streak (a small,
 * uncapped incentive to keep a streak alive rather than let it lapse).
 */
export function computePoints(totalCompletions: number, currentStreak: number): number {
  return totalCompletions * 10 + currentStreak * 5;
}

/**
 * Level N requires a triangular-number curve of points — level 1: 0, level
 * 2: 100, level 3: 300, level 4: 600, level 5: 1000 — each level takes a bit
 * more than the last without exploding for a personal, single-user habit
 * tracker.
 */
export function pointsRequiredForLevel(level: number): number {
  return ((level - 1) * level * 100) / 2;
}

export function computeLevel(points: number): number {
  let level = 1;
  while (points >= pointsRequiredForLevel(level + 1)) {
    level++;
  }
  return level;
}

export const LEVEL_TITLES = [
  "Beginner",
  "Getting Started",
  "Building Momentum",
  "Consistent",
  "Dedicated",
  "Habit Master",
] as const;

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? LEVEL_TITLES[0];
}
