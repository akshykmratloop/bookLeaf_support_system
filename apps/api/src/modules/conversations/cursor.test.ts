import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, newestFirst } from './cursor.js';
import { titleOf } from './summary.js';

const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';
const AT = new Date('2026-10-27T10:00:00.000Z');

describe('history cursor', () => {
  it('reads back what it wrote', () => {
    expect(decodeCursor(encodeCursor({ at: AT, id: ID_A }))).toEqual({ at: AT, id: ID_A });
  });

  it('rejects a cursor it did not write', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow('Invalid cursor');
  });

  it('rejects a well-formed cursor whose id is not a uuid (the database would refuse it)', () => {
    const forged = encodeCursor({ at: AT, id: '-'.repeat(36) });
    expect(() => decodeCursor(forged)).toThrow('Invalid cursor');
  });

  it('sorts newest first, breaking a tie on time by the larger id', () => {
    const older = { at: new Date(AT.getTime() - 1000), id: ID_B };
    const rows = [older, { at: AT, id: ID_A }, { at: AT, id: ID_B }].sort(newestFirst);
    expect(rows.map((r) => r.id)).toEqual([ID_B, ID_A, ID_B]);
    expect(rows[2]).toBe(older);
  });
});

describe('titleOf', () => {
  it('prefers the ticket subject, then the first words, then a plain label', () => {
    expect(titleOf('Blurry pages', 'hello')).toBe('Blurry pages');
    expect(titleOf('', '  my   royalty\nlooks low ')).toBe('my royalty looks low');
    expect(titleOf(undefined, undefined)).toBe('Conversation');
  });

  it('clips long text to 80 characters', () => {
    expect(titleOf(undefined, 'x'.repeat(200))).toHaveLength(80);
  });
});
