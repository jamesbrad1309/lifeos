export type Valence = "pleasant" | "neutral" | "unpleasant";

export interface Emotion {
  /** Stored as-is in JournalEntry.emotion. Displayed via `journal.emotions.<name>`. */
  name: string;
  emoji: string;
  valence: Valence;
}

/**
 * The emotion vocabulary for FEELING entries. The API stores any word, so
 * this list can grow without a migration — entries using a word that's
 * later removed still render, via `emotionFor`'s fallback.
 */
export const EMOTIONS: Emotion[] = [
  { name: "happy", emoji: "😊", valence: "pleasant" },
  { name: "grateful", emoji: "🙏", valence: "pleasant" },
  { name: "calm", emoji: "😌", valence: "pleasant" },
  { name: "excited", emoji: "🤩", valence: "pleasant" },
  { name: "proud", emoji: "💪", valence: "pleasant" },
  { name: "loved", emoji: "🥰", valence: "pleasant" },
  { name: "hopeful", emoji: "🌱", valence: "pleasant" },
  { name: "relieved", emoji: "😮‍💨", valence: "pleasant" },
  { name: "energized", emoji: "⚡", valence: "pleasant" },
  { name: "okay", emoji: "😐", valence: "neutral" },
  { name: "curious", emoji: "🤔", valence: "neutral" },
  { name: "bored", emoji: "🥱", valence: "neutral" },
  { name: "numb", emoji: "😶", valence: "neutral" },
  { name: "anxious", emoji: "😰", valence: "unpleasant" },
  { name: "stressed", emoji: "😣", valence: "unpleasant" },
  { name: "sad", emoji: "😢", valence: "unpleasant" },
  { name: "angry", emoji: "😠", valence: "unpleasant" },
  { name: "frustrated", emoji: "😤", valence: "unpleasant" },
  { name: "tired", emoji: "😴", valence: "unpleasant" },
  { name: "lonely", emoji: "🥺", valence: "unpleasant" },
  { name: "overwhelmed", emoji: "🤯", valence: "unpleasant" },
  { name: "disappointed", emoji: "😞", valence: "unpleasant" },
  { name: "guilty", emoji: "😔", valence: "unpleasant" },
];

const BY_NAME = new Map(EMOTIONS.map((emotion) => [emotion.name, emotion]));

export function emotionFor(name: string): Emotion {
  return BY_NAME.get(name) ?? { name, emoji: "💭", valence: "neutral" };
}

/** Share of pleasant / neutral / unpleasant among `names`, for the mood-mix bar. */
export function valenceMix(names: string[]): Record<Valence, number> {
  const mix: Record<Valence, number> = { pleasant: 0, neutral: 0, unpleasant: 0 };
  for (const name of names) mix[emotionFor(name).valence]++;
  return mix;
}
