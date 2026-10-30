import { DataSourceListSchema, UrlTemplateSchema } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { readPath } from './path.js';
import { expandTemplate, MissingEmailError } from './template.js';
import { toFactValue } from './values.js';

describe('URL templates', () => {
  it('fills {id} and {email} URL-encoded, anywhere in the path or query', () => {
    const url = expandTemplate('https://api.x.com/data/customer/{id}?email={email}', {
      id: 'a b/c',
      email: 'sam+1@x.com',
    });
    expect(url.toString()).toBe('https://api.x.com/data/customer/a%20b%2Fc?email=sam%2B1%40x.com');
  });

  it('refuses an {email} template when no email is known', () => {
    expect(() =>
      expandTemplate('https://api.x.com/users?email={email}', { id: 'C1', email: null }),
    ).toThrow(MissingEmailError);
  });

  it('accepts only http(s) templates whose host comes before any placeholder', () => {
    expect(UrlTemplateSchema.safeParse('https://api.x.com/users?email={email}').success).toBe(true);
    for (const bad of [
      'https://{id}.x.com/customer',
      'https://api.x.com{id}',
      'ftp://api.x.com/{id}',
      'https://api.x.com/customer/{name}',
      'https://api.x.com/customer/all',
    ])
      expect(UrlTemplateSchema.safeParse(bad).success, bad).toBe(false);
  });

  it('allows one to five sources with distinct names and at most one in the fixed shape', () => {
    const src = (name: string, format: 'CONTRACT' | 'MAPPED' = 'MAPPED') => ({
      name,
      format,
      urlTemplate: `https://api.x.com/${name}/{id}`,
    });
    expect(DataSourceListSchema.safeParse([src('a')]).success).toBe(true);
    expect(DataSourceListSchema.safeParse([]).success).toBe(false);
    expect(
      DataSourceListSchema.safeParse(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => src(n))).success,
    ).toBe(false);
    expect(DataSourceListSchema.safeParse([src('a'), src('A')]).success).toBe(false);
    expect(
      DataSourceListSchema.safeParse([src('a', 'CONTRACT'), src('b', 'CONTRACT')]).success,
    ).toBe(false);
  });
});

describe('readPath', () => {
  const json = { data: { user: { name: 'Asha' }, books: [{ id: 'B1' }] }, __proto__x: 1 };

  it('reads dotted paths, array indexes and the whole response', () => {
    expect(readPath(json, 'data.user.name')).toBe('Asha');
    expect(readPath(json, 'data.books.0.id')).toBe('B1');
    expect(readPath(json, '$')).toBe(json);
  });

  it('returns undefined for a missing path and never reads inherited properties', () => {
    expect(readPath(json, 'data.user.email')).toBeUndefined();
    expect(readPath(json, 'data.books.5.id')).toBeUndefined();
    expect(readPath(json, 'constructor')).toBeUndefined();
    expect(readPath('text', 'length')).toBeUndefined();
  });
});

describe('toFactValue', () => {
  it('turns product values into fact values with a display', () => {
    expect(toFactValue('MONEY', 357000, [])).toEqual({
      ok: true,
      value: 357000,
      display: '3,570.00',
    });
    expect(toFactValue('NUMBER', '3', [])).toEqual({ ok: true, value: 3, display: '3' });
    expect(toFactValue('DATE', '2026-02-14T10:00:00Z', [])).toEqual({
      ok: true,
      value: '2026-02-14',
      display: '14 Feb 2026',
    });
    expect(toFactValue('STATUS', 'below_threshold', ['BELOW_THRESHOLD'])).toEqual({
      ok: true,
      value: 'BELOW_THRESHOLD',
      display: 'Below threshold',
    });
    expect(toFactValue('TEXT', '  Hello  ', [])).toEqual({
      ok: true,
      value: 'Hello',
      display: 'Hello',
    });
  });

  it('refuses missing, mistyped and unexpected values with a reason', () => {
    expect(toFactValue('TEXT', undefined, [])).toMatchObject({ ok: false });
    expect(toFactValue('MONEY', 'lots', [])).toMatchObject({ ok: false });
    expect(toFactValue('DATE', 'soon', [])).toMatchObject({ ok: false });
    expect(toFactValue('STATUS', 'WEIRD', ['OK'])).toMatchObject({ ok: false });
    expect(toFactValue('TEXT', { a: 1 }, [])).toMatchObject({ ok: false });
  });
});
