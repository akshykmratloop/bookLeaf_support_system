import type { ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ id, label, hint, error, counter, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-ink-2">
          {label}
        </label>
        {counter ? <span className="font-mono text-[11px] text-ink-3">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
