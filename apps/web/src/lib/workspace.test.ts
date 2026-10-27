import { describe, expect, it } from 'vitest';
import { slugFromName } from './workspace';

describe('slugFromName', () => {
  it('lowercases, replaces runs of symbols with one hyphen and trims the ends', () => {
    expect(slugFromName('Acme Lending, Inc.')).toBe('acme-lending-inc');
    expect(slugFromName('  BookLeaf  ')).toBe('bookleaf');
  });

  it('caps the length at 40 characters', () => {
    expect(slugFromName('a'.repeat(60))).toHaveLength(40);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugFromName('***')).toBe('');
  });
});
