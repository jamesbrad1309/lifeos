import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Upper-cases only the first letter: "lo âu" → "Lo âu". CSS `capitalize`
 * upper-cases every word, which is wrong for multi-word Vietnamese phrases.
 */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
