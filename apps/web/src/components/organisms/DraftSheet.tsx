import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The ticket as a sheet that slides up over the chat in the narrow widget. Esc and the backdrop
 * close it; the draft keeps saving while it is closed.
 */
export function DraftSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // the sheet handles Esc; the widget stays open
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close the ticket"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your ticket"
        className="relative max-h-[88%] animate-slide-up overflow-y-auto overscroll-none rounded-t-[24px] bg-app p-3 shadow-float"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-panel-2"
        >
          <X size={16} aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
