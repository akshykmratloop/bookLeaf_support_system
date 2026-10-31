import { CheckCircle2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

const ToastContext = createContext<(tone: ToastTone, text: string) => void>(() => undefined);

/** Errors stay long enough to read and act on; confirmations pass quickly. */
const TOAST_MS: Record<ToastTone, number> = { success: 4000, error: 8000 };
export const toastDuration = (tone: ToastTone): number => TOAST_MS[tone];

export function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const isError = item.tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-[12px] border border-line-strong bg-panel py-3 pr-2 pl-4 text-[13px] shadow-lg"
    >
      {isError ? (
        <XCircle size={16} className="shrink-0 text-danger" aria-hidden />
      ) : (
        <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
      )}
      <span className="flex-1">{item.text}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-panel-2 hover:text-ink"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Short notices in the corner. Errors are announced at once (role="alert", assertive) and stay
 * 8 seconds; confirmations are announced politely and stay 4. Each can be dismissed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);
  const push = useCallback(
    (tone: ToastTone, text: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, tone, text }]);
      setTimeout(() => dismiss(id), toastDuration(tone));
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  const region = (tone: ToastTone, live: 'polite' | 'assertive') => (
    <div aria-live={live} className="flex flex-col gap-2">
      {items
        .filter((t) => t.tone === tone)
        .map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
    </div>
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {region('error', 'assertive')}
        {region('success', 'polite')}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
