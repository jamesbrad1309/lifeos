import { useEffect } from "react";
import { useStoredState } from "#hooks/useStoredState";

export type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark via the `.dark` class index.css already defines; starts from the OS setting. */
export function useTheme() {
  const [theme, setTheme] = useStoredState<Theme>("lifeos.theme", systemTheme());
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
