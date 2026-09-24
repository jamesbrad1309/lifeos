import { useEffect, useState } from "react";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * `useState` remembered in localStorage — for per-browser UI preferences
 * (sidebar collapsed, theme) only, never data. Storage can be unavailable
 * (private mode, blocked site data), in which case it's plain state.
 */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not persisted this time; the in-memory value still works.
    }
  }, [key, value]);
  return [value, setValue] as const;
}
