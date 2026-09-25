import { useSyncExternalStore } from "react";

/** What to start the sheet with: from a deep link (`/log?amount=3.40&category=coffee`) or a preset. */
export interface QuickLogPrefill {
  /** As typed: "3.40". */
  amount?: string;
  /** A category name or alias, matched when the sheet opens. */
  category?: string;
}

interface QuickLogState {
  open: boolean;
  prefill: QuickLogPrefill | null;
  /** Bumps on every open, so the sheet resets even if it was already open. */
  session: number;
}

let state: QuickLogState = { open: false, prefill: null, session: 0 };
const listeners = new Set<() => void>();

function set(next: QuickLogState) {
  state = next;
  for (const listener of listeners) listener();
}

/**
 * Opens the quick-log sheet over whatever page is showing. Plain functions,
 * not a hook, so the `/log` route's `beforeLoad` and the `n` shortcut can
 * call them too.
 */
export function openQuickLog(prefill: QuickLogPrefill | null = null): void {
  set({ open: true, prefill, session: state.session + 1 });
}

export function closeQuickLog(): void {
  set({ ...state, open: false });
}

export function useQuickLogState(): QuickLogState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
