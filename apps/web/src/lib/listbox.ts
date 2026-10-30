/**
 * Keyboard logic of a select-only combobox (WAI-ARIA APG "Select-Only Combobox"), kept free of
 * React so it can be unit tested. Disabled options can be reached (a screen reader then reads
 * why they are unavailable) but never picked.
 */
export interface ListboxItem {
  label: string;
  disabled?: boolean;
}

export interface ListboxState {
  isOpen: boolean;
  /** The option the keyboard is on; -1 when there is none. */
  activeIndex: number;
}

export interface KeyResult {
  state: ListboxState;
  /** Index of the option to pick now, or null. */
  commit: number | null;
  /** True when the key was used here, so the caller prevents its default action. */
  handled: boolean;
}

export const CLOSED: ListboxState = { isOpen: false, activeIndex: -1 };

const OPEN_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

const clamp = (index: number, count: number) => Math.min(Math.max(index, 0), count - 1);

const result = (state: ListboxState, handled = true, commit: number | null = null): KeyResult => ({
  state,
  commit,
  handled,
});

function whenClosed(key: string, count: number, selectedIndex: number): KeyResult {
  if (key === 'Home' || key === 'End') {
    if (count === 0) return result(CLOSED);
    return result({ isOpen: true, activeIndex: key === 'Home' ? 0 : count - 1 });
  }
  if (!OPEN_KEYS.has(key)) return result(CLOSED, false);
  if (count === 0) return result(CLOSED);
  return result({ isOpen: true, activeIndex: selectedIndex >= 0 ? selectedIndex : 0 });
}

function pick(state: ListboxState, items: readonly ListboxItem[]): KeyResult {
  const item = items[state.activeIndex];
  if (!item || item.disabled) return result(state);
  return result(CLOSED, true, state.activeIndex);
}

function whenOpen(
  state: ListboxState,
  event: { key: string; altKey: boolean },
  items: readonly ListboxItem[],
): KeyResult {
  const count = items.length;
  const move = (index: number) => result({ isOpen: true, activeIndex: clamp(index, count) });
  switch (event.key) {
    case 'ArrowDown':
      return move(state.activeIndex + 1);
    case 'ArrowUp':
      return event.altKey ? pick(state, items) : move(state.activeIndex - 1);
    case 'Home':
      return move(0);
    case 'End':
      return move(count - 1);
    case 'Enter':
    case ' ':
      return pick(state, items);
    case 'Escape':
      return result(CLOSED);
    case 'Tab':
      return result(CLOSED, false);
    default:
      return result(state, false);
  }
}

/** What a key press does to the listbox. `selectedIndex` is the current value's option. */
export function reduceKey(
  state: ListboxState,
  event: { key: string; altKey: boolean },
  items: readonly ListboxItem[],
  selectedIndex: number,
): KeyResult {
  return state.isOpen
    ? whenOpen(state, event, items)
    : whenClosed(event.key, items.length, selectedIndex);
}

/**
 * The option a typed prefix points to. One character moves on from the current option (so
 * pressing "g" again cycles through every "G…" option); a longer prefix keeps the current option
 * while it still matches.
 */
export function typeaheadIndex(
  items: readonly ListboxItem[],
  currentIndex: number,
  typed: string,
): number {
  const count = items.length;
  if (count === 0 || typed === '') return -1;
  const prefix = typed.toLocaleLowerCase();
  const start = typed.length === 1 ? currentIndex + 1 : Math.max(currentIndex, 0);
  for (let step = 0; step < count; step += 1) {
    const index = (((start + step) % count) + count) % count;
    if (items[index]?.label.toLocaleLowerCase().startsWith(prefix)) return index;
  }
  return -1;
}
