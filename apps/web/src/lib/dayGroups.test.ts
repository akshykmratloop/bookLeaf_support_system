import { describe, expect, it } from 'vitest';
import { groupByDay } from './dayGroups';

const NOW = new Date('2026-10-27T15:00:00');

describe('groupByDay', () => {
  it('groups items under Today, Yesterday and a date, keeping their order', () => {
    const items = [
      { id: 'a', at: '2026-10-27T09:00:00' },
      { id: 'b', at: '2026-10-27T08:00:00' },
      { id: 'c', at: '2026-10-26T20:00:00' },
      { id: 'd', at: '2026-10-20T10:00:00' },
    ];
    const groups = groupByDay(items, (i) => i.at, NOW);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Tue, 20 Oct 2026', ['d']],
    ]);
  });

  it('returns nothing for no items', () => {
    expect(groupByDay([], () => '', NOW)).toEqual([]);
  });
});
