import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  text: string;
}

const ToastContext = createContext<(tone: ToastItem['tone'], text: string) => void>(() => undefined);
const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), TOAST_MS);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-[12px] border border-line-strong bg-panel px-4 py-3 text-[13px] shadow-lg">
            {t.tone === 'success' ? <CheckCircle2 size={16} className="text-success" aria-hidden /> : <XCircle size={16} className="text-danger" aria-hidden />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
