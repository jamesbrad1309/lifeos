import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { openQuickLog, useQuickLogState } from "#hooks/useQuickLog";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * The floating ➕ on every screen, and `n` from anywhere that isn't a text
 * field: getting to the log has to be as fast as logging.
 */
export function QuickLogButton() {
  const { t } = useTranslation();
  const { open } = useQuickLogState();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      // Another dialog (an edit form) is open: `n` belongs to it.
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      openQuickLog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (open) return null;
  return (
    <button
      type="button"
      onClick={() => openQuickLog()}
      aria-label={t("finance.quickLog.open")}
      title={t("finance.quickLog.openHint")}
      className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform outline-none hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/50 lg:right-8 lg:bottom-8"
    >
      <Plus className="size-6" />
    </button>
  );
}
