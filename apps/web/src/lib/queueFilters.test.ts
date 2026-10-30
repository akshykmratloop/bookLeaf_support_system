import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, isFiltered } from './queueFilters';

describe('isFiltered', () => {
  it('is false for no filters, even with a sort chosen', () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, sort: 'oldest' })).toBe(false);
  });

  it('is true once any filter is set', () => {
    expect(isFiltered({ ...EMPTY_FILTERS, priority: 'HIGH' })).toBe(true);
  });
});
