import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts } from "#lib/toast";

/** Renders `lib/toast.ts`'s toasts, bottom-centre, newest last. Mounted once in the shell. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <output
          key={t.id}
          className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg"
        >
          <span className="min-w-0 truncate">{t.message}</span>
          {t.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {action.label}
            </button>
          ))}
        </output>
      ))}
    </div>
  );
}
