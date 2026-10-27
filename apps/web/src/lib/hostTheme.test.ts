import { describe, expect, it, vi } from 'vitest';
import { followHostTheme, themeFromHash } from './hostTheme';

function fakeWindow(hash: string) {
  const parent = {};
  let listener: ((e: { source: unknown; data: unknown }) => void) | null = null;
  const win = {
    parent,
    location: { hash },
    addEventListener: (_: string, fn: typeof listener) => {
      listener = fn;
    },
    removeEventListener: vi.fn(),
  };
  const post = (source: unknown, data: unknown) => listener?.({ source, data });
  return { win: win as unknown as Window, parent, post };
}

describe('the widget follows the host page theme', () => {
  it('reads the theme the host put in the frame address', () => {
    expect(themeFromHash('#t=abc&theme=dark')).toBe('dark');
    expect(themeFromHash('#t=abc&theme=light')).toBe('light');
    expect(themeFromHash('#t=abc')).toBeNull();
    expect(themeFromHash('#theme=purple')).toBeNull();
  });

  it('applies it at once and again whenever the host page switches', () => {
    const { win, parent, post } = fakeWindow('#t=x&theme=dark');
    const set = vi.fn();
    followHostTheme(win, set);
    expect(set).toHaveBeenLastCalledWith('dark');
    post(parent, { type: 'bookleaf-support:theme', theme: 'light' });
    expect(set).toHaveBeenLastCalledWith('light');
  });

  it('ignores messages from anyone but the host page, and unknown values', () => {
    const { win, parent, post } = fakeWindow('');
    const set = vi.fn();
    followHostTheme(win, set);
    post({}, { type: 'bookleaf-support:theme', theme: 'dark' });
    post(parent, { type: 'bookleaf-support:theme', theme: 'neon' });
    post(parent, { type: 'other', theme: 'dark' });
    expect(set).not.toHaveBeenCalled();
  });
});
