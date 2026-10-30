import type { DataSource, RecordMapping } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import {
  fieldSourceLabel,
  mappableSources,
  mappingDraftOf,
  newSourceDraft,
  sourceDraftsOf,
  toRecordMapping,
  toSourceInputs,
} from './dataSources';

const PROFILE = '0b6f3c1e-5d2a-4c1b-9e8f-1a2b3c4d5e6f';
const BOOKS = '1c7a4d2f-6e3b-4d2c-8f9a-2b3c4d5e6f70';

const source = (patch: Partial<DataSource> = {}): DataSource => ({
  id: PROFILE,
  name: 'Profile',
  urlTemplate: 'https://api.acme.example/users/{id}',
  format: 'MAPPED',
  authHeader: null,
  timeoutMs: 3000,
  cacheSeconds: 60,
  ...patch,
});

describe('source drafts', () => {
  it('starts with one fixed-shape source when nothing is saved yet', () => {
    const [draft] = sourceDraftsOf([]);
    expect(draft).toMatchObject({ name: 'Customer', format: 'CONTRACT', urlTemplate: '' });
  });

  it('round-trips saved sources, keeping ids so field mappings stay', () => {
    const input = toSourceInputs(sourceDraftsOf([source({ authHeader: 'X-Api-Key' })]));
    expect(input).toEqual([
      {
        id: PROFILE,
        name: 'Profile',
        urlTemplate: 'https://api.acme.example/users/{id}',
        format: 'MAPPED',
        authHeader: 'X-Api-Key',
        timeoutMs: 3000,
        cacheSeconds: 60,
      },
    ]);
  });

  it('drops the server-settings id and sends an empty auth header as Bearer (null)', () => {
    const env = source({ id: 'env', format: 'CONTRACT' });
    const [input] = toSourceInputs(sourceDraftsOf([env]).map((d) => ({ ...d, authHeader: '  ' })));
    expect(input).not.toHaveProperty('id');
    expect(input?.authHeader).toBeNull();
  });

  it('names a new source after its position and maps any JSON by default', () => {
    expect(newSourceDraft(2)).toMatchObject({ name: 'Source 3', format: 'MAPPED' });
    expect(newSourceDraft(2).key).not.toBe(newSourceDraft(2).key);
  });
});

describe('mapping drafts', () => {
  const mapping: RecordMapping = {
    name: { sourceId: PROFILE, path: 'data.user.name' },
    email: null,
    items: { sourceId: BOOKS, path: 'books', idPath: 'isbn', titlePath: null },
  };

  it('round-trips a saved record mapping', () => {
    expect(toRecordMapping(mappingDraftOf(mapping))).toEqual(mapping);
  });

  it('treats an empty pair as not mapped and trims paths', () => {
    const draft = mappingDraftOf(mapping);
    draft.name = { sourceId: PROFILE, path: '  data.name ' };
    draft.items = { sourceId: '', path: '', idPath: '', titlePath: '' };
    expect(toRecordMapping(draft)).toEqual({
      name: { sourceId: PROFILE, path: 'data.name' },
      email: null,
      items: null,
    });
  });
});

describe('labels', () => {
  const sources = [source(), source({ id: 'env', name: 'Customer', format: 'CONTRACT' })];

  it('offers only saved sources for mapping', () => {
    expect(mappableSources(sources).map((s) => s.id)).toEqual([PROFILE]);
  });

  it('describes where a field is read from', () => {
    expect(fieldSourceLabel(sources, { key: 'plan', sourceId: PROFILE, path: 'plan.name' })).toBe(
      'Profile → plan.name',
    );
    expect(
      fieldSourceLabel(sources, { key: 'book.{id}.sales', sourceId: null, path: 'sold' }),
    ).toBe('Each item → sold');
    expect(fieldSourceLabel(sources, { key: 'plan', sourceId: null, path: null })).toBeNull();
  });
});
