import type { HostCustomer } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import { buildCustomer } from './build.js';
import type { FieldSpec, MappingSpec, SourceResult, SourceSpec } from './types.js';

const source = (id: string, format: SourceSpec['format'] = 'MAPPED'): SourceSpec => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
  urlTemplate: `https://api.x.com/${id}/{id}`,
  format,
  authHeader: null,
  timeoutMs: 1000,
  cacheSeconds: 60,
});
const field = (key: string, over: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label: key,
  type: 'TEXT',
  allowedValues: [],
  visibleToCustomer: true,
  sourceId: null,
  path: null,
  ...over,
});
const MAPPED_EMPTY: MappingSpec['record'] = { name: null, email: null, items: null };
const ok = (json: unknown): SourceResult => ({ ok: true, status: 200, json });
const down: SourceResult = { ok: false, status: 500, reason: 'status 500' };

const CONTRACT: HostCustomer = {
  id: 'C1',
  name: 'Asha Rao',
  email: 'asha@x.com',
  items: [{ id: 'B1', title: 'Monsoon', facts: [], details: [] }],
  facts: [],
  details: [],
};

/** Profile (name, email), Books (the item list) and Payouts (one account field). */
const MAPPED: MappingSpec = {
  record: {
    name: { sourceId: 'profile', path: 'data.user.name' },
    email: { sourceId: 'profile', path: 'data.user.email' },
    items: { sourceId: 'books', path: 'books', idPath: 'isbn', titlePath: 'title' },
  },
  fields: [
    field('account.pending', { type: 'MONEY', sourceId: 'payouts', path: 'pending' }),
    field('book.{id}.stage', { type: 'STATUS', allowedValues: ['PRINTING'], path: 'stage' }),
  ],
};
const SOURCES = [source('profile'), source('books'), source('payouts')];
const answers = (over: Record<string, SourceResult> = {}) =>
  new Map(
    Object.entries({
      profile: ok({ data: { user: { name: 'Asha Rao', email: 'asha@x.com' } } }),
      books: ok({ books: [{ isbn: '978-1', title: 'Monsoon', stage: 'printing' }] }),
      payouts: ok({ pending: 357000 }),
      ...over,
    }),
  );

const build = (results: Map<string, SourceResult>, mapping = MAPPED, sources = SOURCES) =>
  buildCustomer({ externalId: 'C1', sources, mapping, results });

describe('buildCustomer', () => {
  it('passes a fixed-shape (contract) answer through unchanged', () => {
    const r = build(new Map([['main', ok(CONTRACT)]]), { record: MAPPED_EMPTY, fields: [] }, [
      source('main', 'CONTRACT'),
    ]);
    expect(r).toEqual({ customer: CONTRACT, unavailable: [] });
  });

  it('merges several mapped sources into one customer record', () => {
    const { customer, unavailable } = build(answers());
    expect(unavailable).toEqual([]);
    expect(customer).toMatchObject({ id: 'C1', name: 'Asha Rao', email: 'asha@x.com' });
    expect(customer.facts).toEqual([
      expect.objectContaining({ id: 'account.pending', type: 'MONEY', value: 357000 }),
    ]);
    expect(customer.facts[0]?.source).toEqual({
      kind: 'RECORD',
      table: 'Payouts',
      recordId: 'C1',
      field: 'pending',
    });
    expect(customer.items).toEqual([
      {
        id: '978-1',
        title: 'Monsoon',
        facts: [expect.objectContaining({ id: 'book.978-1.stage', value: 'PRINTING' })],
        details: [{ label: 'book.{id}.stage', display: 'Printing' }],
      },
    ]);
  });

  it('keeps the other fields when one source fails, marking its fields unavailable', () => {
    const { customer, unavailable } = build(answers({ payouts: down }));
    expect(customer.items).toHaveLength(1);
    expect(unavailable).toEqual([{ key: 'account.pending', reason: 'Payouts: status 500' }]);
    expect(customer.facts[0]).toMatchObject({
      id: 'account.pending',
      value: null,
      display: 'Unavailable',
      source: { kind: 'MISSING' },
    });
    expect(customer.details).toEqual([{ label: 'account.pending', display: 'Unavailable' }]);
  });

  it('marks the item list unavailable when its source fails', () => {
    const { customer, unavailable } = build(answers({ books: down }));
    expect(customer.items).toEqual([]);
    expect(unavailable.map((u) => u.key)).toEqual(['items']);
    expect(customer.facts.map((f) => f.id)).toContain('host.items_unavailable');
  });

  it('needs the source with the name and email: down → unavailable, 404 → not found', () => {
    expect(() => build(answers({ profile: down }))).toThrow(HostUnavailableError);
    const missing: SourceResult = { ok: false, status: 404, reason: 'status 404' };
    expect(() => build(answers({ profile: missing }))).toThrow(CustomerNotFoundError);
    const noName = ok({ data: { user: { email: 'asha@x.com' } } });
    expect(() => build(answers({ profile: noName }))).toThrow(HostUnavailableError);
  });

  it('refuses a mapped record without name and email mapping', () => {
    expect(() => build(answers(), { ...MAPPED, record: MAPPED_EMPTY })).toThrow(
      HostUnavailableError,
    );
  });

  it('adds mapped fields on top of a fixed-shape answer, item facts by item id', () => {
    const mapping: MappingSpec = {
      record: { ...MAPPED_EMPTY, items: { ...MAPPED.record.items!, idPath: 'id' } },
      fields: [
        field('book.{id}.note', { path: 'note' }),
        field('account.tier', { sourceId: 'extra', path: 'tier' }),
      ],
    };
    const { customer } = build(
      new Map([
        ['main', ok(CONTRACT)],
        ['books', ok({ books: [{ id: 'B1', note: 'Signed copy' }] })],
        ['extra', ok({ tier: 'Gold' })],
      ]),
      mapping,
      [source('main', 'CONTRACT'), source('books'), source('extra')],
    );
    expect(customer.name).toBe('Asha Rao');
    expect(customer.items).toHaveLength(1);
    expect(customer.items[0]?.title).toBe('Monsoon');
    expect(customer.items[0]?.facts.map((f) => f.display)).toEqual(['Signed copy']);
    expect(customer.facts.map((f) => f.display)).toEqual(['Gold']);
  });

  it('marks a value that breaks its field type as unavailable', () => {
    const { unavailable } = build(answers({ payouts: ok({ pending: 'a lot' }) }));
    expect(unavailable[0]?.key).toBe('account.pending');
  });
});
