/**
 * App-wide toasts ("£3.40 Coffee logged · Undo"). A tiny external store, so
 * anything can raise one — including code that outlives the component that
 * started it, like the quick-log sheet closing right after a save.
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  actions: ToastAction[];
}

interface ToastOptions {
  actions?: ToastAction[];
  durationMs?: number;
  /** Called if the toast times out without an action being taken. */
  onExpire?: () => void;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Shows a toast for `durationMs` (5 s); taking an action closes it. Keeps the newest 3. */
export function toast(
  message: string,
  { actions = [], durationMs = 5000, onExpire }: ToastOptions = {},
) {
  const id = nextId++;
  const wrapped = actions.map((action) => ({
    label: action.label,
    onClick: () => {
      dismissToast(id);
      action.onClick();
    },
  }));
  toasts = [...toasts, { id, message, actions: wrapped }].slice(-3);
  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
      onExpire?.();
    }, durationMs),
  );
  emit();
  return id;
}
