import { describe, expect, it } from 'vitest';
import { firstFreePrefix, PREFIX_FALLBACK, prefixBase } from './ticket-prefix.js';

describe('prefixBase', () => {
  it('uses the capitals of a one-word name and the initials of a longer one', () => {
    expect(prefixBase('BookLeaf')).toBe('BL');
    expect(prefixBase('Acme Corp')).toBe('AC');
    expect(prefixBase('acme lending and finance co')).toBe('ALAFC');
  });

  it('keeps 2 to 5 letters', () => {
    expect(prefixBase('One Two Three Four Five Six Seven')).toBe('OTTFF');
    expect(prefixBase('acme')).toBe('AC');
    expect(prefixBase('IBM')).toBe('IBM');
  });

  it('reads accented letters as plain ones and ignores digits and symbols', () => {
    expect(prefixBase('Éditions Lumière')).toBe('EL');
    expect(prefixBase('42 Acme & Sons!')).toBe('AS');
  });

  it(`falls back to ${PREFIX_FALLBACK} when the name has fewer than 2 letters`, () => {
    expect(prefixBase('X')).toBe(PREFIX_FALLBACK);
    expect(prefixBase('1234')).toBe(PREFIX_FALLBACK);
    expect(prefixBase('   ')).toBe(PREFIX_FALLBACK);
  });
});

describe('firstFreePrefix', () => {
  it('returns the base when it is free', () => {
    expect(firstFreePrefix('BL', [])).toBe('BL');
    expect(firstFreePrefix('BL', ['BLX', 'ABL'])).toBe('BL');
  });

  it('appends the first free number: BL → BL2 → BL3', () => {
    expect(firstFreePrefix('BL', ['BL'])).toBe('BL2');
    expect(firstFreePrefix('BL', ['BL', 'BL2'])).toBe('BL3');
    expect(firstFreePrefix('BL', ['BL', 'BL3'])).toBe('BL2');
  });
});
