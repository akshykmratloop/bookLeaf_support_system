import { ChevronDown } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useDropdown, type DropdownOption } from '../../lib/useDropdown';
import { controlClass } from '../atoms/Input';
import { DropdownOptions, optionId } from './DropdownOptions';

export type { DropdownOption } from '../../lib/useDropdown';

export interface DropdownProps<V extends string> {
  /** Required: a <label htmlFor={id}> (e.g. Field) names it, and the list's ids derive from it. */
  id: string;
  value: V;
  options: readonly DropdownOption<V>[];
  onChange: (value: V) => void;
  /** Adds a hidden input, for forms read with FormData. */
  name?: string;
  /** The name when no visible label points at `id`. */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  disabled?: boolean;
  /** Shown when `value` matches no option. */
  placeholder?: string;
  className?: string;
  /** Extra classes for the open list, for example a minimum width wider than the trigger. */
  listClassName?: string;
}

type TriggerAttributes = Pick<
  DropdownProps<string>,
  'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid' | 'disabled' | 'placeholder'
>;

interface TriggerProps {
  props: TriggerAttributes;
  label: string | null;
  isOpen: boolean;
  activeIndex: number;
  onToggle: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

const preventSpaceClick = (e: KeyboardEvent<HTMLElement>) => {
  if (e.key === ' ') e.preventDefault();
};

function Trigger({ props, label, isOpen, activeIndex, onToggle, onKeyDown }: TriggerProps) {
  const { id, disabled = false, placeholder = 'Choose…' } = props;
  return (
    <button
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={`${id}-listbox`}
      aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(id, activeIndex) : undefined}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onKeyUp={preventSpaceClick}
      className={`flex h-[38px] items-center justify-between gap-2 text-left ${controlClass} ${
        isOpen ? 'border-brand ring-4 ring-brand/15' : ''
      }`}
    >
      <span className={`min-w-0 truncate ${label === null ? 'text-ink-3' : ''}`}>
        {label ?? placeholder}
      </span>
      <ChevronDown
        size={15}
        aria-hidden
        className={`shrink-0 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

/**
 * One accessible dropdown for every admin form (U-6), instead of the native select element whose
 * macOS menu is see-through and greys out disabled options. Select-only combobox pattern:
 * the trigger keeps focus; arrows, Home/End, Enter/Space, Escape, Tab and typing a label's
 * first letters all work; disabled options stay readable with their reason.
 */
export function Dropdown<V extends string>(props: DropdownProps<V>) {
  const { id, value, options, onChange, name } = props;
  const { rootRef, state, isUpwards, selectedIndex, onKeyDown, commit, toggle, setActive } =
    useDropdown({ options, value, onChange });
  const isOpen = state.isOpen && !props.disabled;
  return (
    <div ref={rootRef} className={`relative min-w-0 ${props.className ?? ''}`}>
      <Trigger
        props={props}
        label={options[selectedIndex]?.label ?? null}
        isOpen={isOpen}
        activeIndex={state.activeIndex}
        onToggle={toggle}
        onKeyDown={onKeyDown}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {isOpen ? (
        <DropdownOptions
          id={id}
          options={options}
          activeIndex={state.activeIndex}
          selectedIndex={selectedIndex}
          isUpwards={isUpwards}
          className={props.listClassName}
          onPick={commit}
          onHover={setActive}
        />
      ) : null}
    </div>
  );
}
