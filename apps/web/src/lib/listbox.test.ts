import { describe, expect, it } from 'vitest';
import { CLOSED, reduceKey, typeaheadIndex, type ListboxItem } from './listbox';

const ITEMS: ListboxItem[] = [
  { label: 'Anthropic' },
  { label: 'OpenAI', disabled: true },
  { label: 'Gemini' },
  { label: 'Grok' },
];

const key = (k: string, altKey = false) => ({ key: k, altKey });
const open = (activeIndex: number) => ({ isOpen: true, activeIndex });

describe('reduceKey when closed', () => {
  it.each(['ArrowDown', 'ArrowUp', 'Enter', ' '])('%s opens on the selected option', (k) => {
    expect(reduceKey(CLOSED, key(k), ITEMS, 2)).toEqual({
      state: open(2),
      commit: null,
      handled: true,
    });
  });

  it('opens on the first option when nothing is selected', () => {
    expect(reduceKey(CLOSED, key('ArrowDown'), ITEMS, -1).state).toEqual(open(0));
  });

  it('Home and End open on the first and last option', () => {
    expect(reduceKey(CLOSED, key('Home'), ITEMS, 2).state).toEqual(open(0));
    expect(reduceKey(CLOSED, key('End'), ITEMS, 0).state).toEqual(open(3));
  });

  it('lets Escape and Tab through untouched, so the page still gets them', () => {
    expect(reduceKey(CLOSED, key('Escape'), ITEMS, 0).handled).toBe(false);
    expect(reduceKey(CLOSED, key('Tab'), ITEMS, 0).handled).toBe(false);
  });

  it('does nothing with no options', () => {
    expect(reduceKey(CLOSED, key('ArrowDown'), [], -1)).toEqual({
      state: CLOSED,
      commit: null,
      handled: true,
    });
  });
});

describe('reduceKey when open', () => {
  it('moves with the arrows and stops at both ends', () => {
    expect(reduceKey(open(0), key('ArrowDown'), ITEMS, 0).state).toEqual(open(1));
    expect(reduceKey(open(3), key('ArrowDown'), ITEMS, 0).state).toEqual(open(3));
    expect(reduceKey(open(0), key('ArrowUp'), ITEMS, 0).state).toEqual(open(0));
    expect(reduceKey(open(2), key('ArrowUp'), ITEMS, 0).state).toEqual(open(1));
  });

  it('lands on disabled options, so a screen reader reads their reason', () => {
    expect(reduceKey(open(0), key('ArrowDown'), ITEMS, 0).state.activeIndex).toBe(1);
  });

  it.each(['Enter', ' '])('%s picks an enabled option and closes', (k) => {
    expect(reduceKey(open(2), key(k), ITEMS, 0)).toEqual({
      state: CLOSED,
      commit: 2,
      handled: true,
    });
  });

  it('never picks a disabled option', () => {
    expect(reduceKey(open(1), key('Enter'), ITEMS, 0)).toEqual({
      state: open(1),
      commit: null,
      handled: true,
    });
  });

  it('Alt+ArrowUp picks the active option and closes', () => {
    expect(reduceKey(open(3), key('ArrowUp', true), ITEMS, 0)).toEqual({
      state: CLOSED,
      commit: 3,
      handled: true,
    });
  });

  it('Escape closes without picking and stops there', () => {
    expect(reduceKey(open(3), key('Escape'), ITEMS, 0)).toEqual({
      state: CLOSED,
      commit: null,
      handled: true,
    });
  });

  it('Tab closes without picking and lets focus move on', () => {
    expect(reduceKey(open(3), key('Tab'), ITEMS, 0)).toEqual({
      state: CLOSED,
      commit: null,
      handled: false,
    });
  });

  it('Home and End jump to the ends', () => {
    expect(reduceKey(open(2), key('Home'), ITEMS, 0).state).toEqual(open(0));
    expect(reduceKey(open(0), key('End'), ITEMS, 0).state).toEqual(open(3));
  });

  it('ignores other keys', () => {
    expect(reduceKey(open(2), key('x'), ITEMS, 0).handled).toBe(false);
  });
});

describe('typeaheadIndex', () => {
  it('finds the next option starting with the typed text, ignoring case', () => {
    expect(typeaheadIndex(ITEMS, 0, 'g')).toBe(2);
    expect(typeaheadIndex(ITEMS, 0, 'GR')).toBe(3);
  });

  it('cycles through options with the same first letter on a repeated key', () => {
    expect(typeaheadIndex(ITEMS, 2, 'g')).toBe(3);
    expect(typeaheadIndex(ITEMS, 3, 'g')).toBe(2);
  });

  it('keeps the current option while the longer text still matches it', () => {
    expect(typeaheadIndex(ITEMS, 3, 'gro')).toBe(3);
  });

  it('includes disabled options and returns -1 when nothing matches', () => {
    expect(typeaheadIndex(ITEMS, 0, 'o')).toBe(1);
    expect(typeaheadIndex(ITEMS, 0, 'z')).toBe(-1);
    expect(typeaheadIndex([], -1, 'a')).toBe(-1);
  });
});
