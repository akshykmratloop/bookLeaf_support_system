import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { CLOSED, reduceKey, typeaheadIndex, type ListboxState } from './listbox';

export interface DropdownOption<V extends string = string> {
  value: V;
  label: string;
  /** A second, quieter line under the label (for example a model's tier). */
  hint?: string;
  disabled?: boolean;
  /** Why a disabled option cannot be picked: shown under it and read by screen readers. */
  disabledReason?: string;
}

/** Typed letters within this gap build one search ("gr" → "Grok"). */
const TYPEAHEAD_RESET_MS = 500;
/** The list's tallest size (max-h-64 plus padding); with less room below it opens upwards. */
const LIST_MAX_HEIGHT_PX = 272;

const opensUpwards = (el: HTMLElement | null) => {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  const below = window.innerHeight - box.bottom;
  return below < LIST_MAX_HEIGHT_PX && box.top > below;
};

const isPrintable = (e: KeyboardEvent) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/** Closes the list on a press anywhere outside `root`. */
function useCloseOnOutsidePress(
  root: RefObject<HTMLElement | null>,
  isOpen: boolean,
  setState: (state: ListboxState) => void,
) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setState(CLOSED);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [root, isOpen, setState]);
}

/** Letters typed in quick succession form one search; a pause starts a new one. */
function useTypedText() {
  const typed = useRef({ text: '', at: 0 });
  return {
    isTyping: () => Date.now() - typed.current.at < TYPEAHEAD_RESET_MS,
    add: (char: string) => {
      const now = Date.now();
      const isFresh = now - typed.current.at >= TYPEAHEAD_RESET_MS;
      typed.current = { text: isFresh ? char : typed.current.text + char, at: now };
      return typed.current.text;
    },
  };
}

interface Args<V extends string> {
  options: readonly DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** State, keyboard and outside-press handling for the Dropdown molecule. */
export function useDropdown<V extends string>({ options, value, onChange }: Args<V>) {
  const [state, setState] = useState<ListboxState>(CLOSED);
  const [isUpwards, setUpwards] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const typed = useTypedText();
  const selectedIndex = options.findIndex((o) => o.value === value);
  useCloseOnOutsidePress(rootRef, state.isOpen, setState);

  const show = (next: ListboxState) => {
    if (next.isOpen && !state.isOpen) setUpwards(opensUpwards(rootRef.current));
    setState(next);
  };
  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    setState(CLOSED);
  };
  const onTyped = (text: string) => {
    const index = typeaheadIndex(options, state.isOpen ? state.activeIndex : selectedIndex, text);
    if (index >= 0) show({ isOpen: true, activeIndex: index });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (isPrintable(e) && (e.key !== ' ' || typed.isTyping())) {
      e.preventDefault();
      onTyped(typed.add(e.key));
      return;
    }
    const next = reduceKey(state, e, options, selectedIndex);
    if (!next.handled) return state.isOpen && !next.state.isOpen ? setState(CLOSED) : undefined;
    e.preventDefault();
    e.stopPropagation();
    return next.commit === null ? show(next.state) : commit(next.commit);
  };

  const toggle = () => show(state.isOpen ? CLOSED : { isOpen: true, activeIndex: selectedIndex });
  const setActive = (activeIndex: number) => setState({ isOpen: true, activeIndex });
  return { rootRef, state, isUpwards, selectedIndex, onKeyDown, commit, toggle, setActive };
}
