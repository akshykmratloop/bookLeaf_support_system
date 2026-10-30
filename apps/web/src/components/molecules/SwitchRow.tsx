import type { ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * A labelled on/off switch (role="switch"): a real checkbox underneath, so it works with the
 * keyboard (Space) and screen readers, styled as a track and thumb in both themes.
 */
export function SwitchRow({ id, label, description, checked, disabled, onChange }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13.5px] font-semibold">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="text-[12.5px] text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? `${id}-desc` : undefined}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-line-strong bg-panel-2 transition-colors checked:border-brand checked:bg-brand focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-soft transition-transform peer-checked:translate-x-5"
        />
      </span>
    </div>
  );
}
