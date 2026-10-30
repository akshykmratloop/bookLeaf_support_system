import { describe, expect, it } from 'vitest';

/**
 * U-6: admin forms use the one accessible Dropdown, never the native <select> (its macOS menu is
 * see-through and greys out disabled options). The native Select atom stays only in the author
 * widget, where the phone's own picker is the better control.
 */
const SOURCES = import.meta.glob<string>(['../pages/**/*.tsx', '../components/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Author widget forms (not admin) and the atom itself. */
const NATIVE_ALLOWED = ['atoms/Input.tsx', 'organisms/TicketForm.tsx', 'molecules/DraftFields.tsx'];

describe('admin selects', () => {
  it('reads the app sources', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it('never render a native <select> outside the author widget', () => {
    const native = Object.entries(SOURCES)
      .filter(([path]) => !NATIVE_ALLOWED.some((allowed) => path.endsWith(allowed)))
      .filter(([, text]) => /<Select\b|<select\b/.test(text))
      .map(([path]) => path);
    expect(native).toEqual([]);
  });
});
