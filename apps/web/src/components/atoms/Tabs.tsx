import { useRef, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Segmented tabs; arrow keys move between them (WAI-ARIA tabs pattern, manual activation). */
export function Tabs<T extends string>({ label, items, value, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    refs.current[(index + step + items.length) % items.length]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-full bg-panel-2 p-1"
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => move(e, i)}
            onClick={() => onChange(item.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${selected ? 'bg-panel text-ink shadow-soft' : 'text-ink-2 hover:text-ink'}`}
          >
            {item.label}
            {item.count ? (
              <span
                className={`rounded-full px-1.5 text-[11px] ${selected ? 'bg-brand-soft text-brand' : 'bg-panel text-ink-3'}`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
