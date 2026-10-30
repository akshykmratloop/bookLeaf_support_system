import { Check, Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { DropdownOption } from '../../lib/useDropdown';

export const optionId = (id: string, index: number) => `${id}-option-${index}`;

interface Props<V extends string> {
  id: string;
  options: readonly DropdownOption<V>[];
  activeIndex: number;
  selectedIndex: number;
  isUpwards: boolean;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

function OptionText<V extends string>({ option }: { option: DropdownOption<V> }) {
  return (
    <span className="min-w-0 flex-1 break-words">
      <span className={`block ${option.disabled ? 'text-ink-2' : 'text-ink'}`}>{option.label}</span>
      {option.disabled ? (
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-2">
          <Lock size={11} aria-hidden className="shrink-0" />
          {option.disabledReason ?? 'Not available'}
        </span>
      ) : option.hint ? (
        <span className="mt-0.5 block text-[12px] text-ink-2">{option.hint}</span>
      ) : null}
    </span>
  );
}

/**
 * The open list: a solid surface (never see-through) with readable text in both themes.
 * Focus stays on the trigger; the active option is announced through aria-activedescendant.
 */
export function DropdownOptions<V extends string>(props: Props<V>) {
  const { id, options, activeIndex, selectedIndex, isUpwards, onPick, onHover } = props;
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);
  return (
    <ul
      ref={listRef}
      id={`${id}-listbox`}
      role="listbox"
      aria-labelledby={id}
      tabIndex={-1}
      className={`absolute inset-x-0 z-50 max-h-64 animate-pop-in overflow-y-auto overscroll-contain rounded-control border border-line-strong bg-panel p-1 shadow-float ${
        isUpwards ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
    >
      {options.map((option, index) => {
        const isActive = index === activeIndex;
        const isSelected = index === selectedIndex;
        return (
          <li
            key={option.value}
            id={optionId(id, index)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            data-active={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => (isActive ? undefined : onHover(index))}
            onClick={() => onPick(index)}
            className={`flex items-start gap-2 rounded-[8px] px-2.5 py-2 text-[13.5px] ${
              option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${isActive ? 'bg-brand-soft' : ''} ${isSelected ? 'font-semibold' : ''}`}
          >
            <Check
              size={14}
              aria-hidden
              className={`mt-0.5 shrink-0 text-brand-ink ${isSelected ? '' : 'invisible'}`}
            />
            <OptionText option={option} />
          </li>
        );
      })}
    </ul>
  );
}
