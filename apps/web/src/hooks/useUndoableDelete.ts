import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Deletes after a grace period instead of asking "are you sure?": the item
 * disappears at once (`pending` ids should be hidden), and `undo` within
 * `delayMs` cancels it. Anything still pending on unmount is committed,
 * so navigating away doesn't silently resurrect it.
 */
export function useUndoableDelete(commit: (id: string) => Promise<unknown>, delayMs = 5000) {
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  const settle = useCallback((id: string) => {
    timers.current.delete(id);
    setPending((ids) => ids.filter((pendingId) => pendingId !== id));
  }, []);

  const remove = useCallback(
    (id: string) => {
      setPending((ids) => [...ids, id]);
      const timer = setTimeout(() => {
        // Keep it hidden until the refetch after the delete has dropped it
        // from the list; if the delete fails, it simply reappears.
        commitRef.current(id).finally(() => settle(id));
      }, delayMs);
      timers.current.set(id, timer);
    },
    [delayMs, settle],
  );

  const undo = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      settle(id);
    },
    [settle],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const [id, timer] of active) {
        clearTimeout(timer);
        void commitRef.current(id);
      }
      active.clear();
    };
  }, []);

  return { pending, remove, undo };
}
