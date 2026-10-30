import { describe, expect, it } from 'vitest';
import { framedFrom } from './widget-load.js';

const ALLOWED = ['https://app.acme.example', 'http://localhost:3200'];

describe('framedFrom: which allowed site framed the widget page', () => {
  it('returns the origin of an allowed page that framed it', () => {
    const headers = {
      referer: 'https://app.acme.example/dashboard?x=1',
      'sec-fetch-dest': 'iframe',
    };
    expect(framedFrom(headers, ALLOWED)).toBe('https://app.acme.example');
  });

  it('accepts a referrer cut to the origin (strict-origin-when-cross-origin)', () => {
    expect(framedFrom({ referer: 'http://localhost:3200/' }, ALLOWED)).toBe(
      'http://localhost:3200',
    );
  });

  it.each([
    [
      'a site that is not allowed',
      { referer: 'https://evil.example/', 'sec-fetch-dest': 'iframe' },
    ],
    ['no referrer', { 'sec-fetch-dest': 'iframe' }],
    [
      'a top-level visit, not a frame',
      { referer: 'https://app.acme.example/', 'sec-fetch-dest': 'document' },
    ],
    ['a referrer that is not a URL', { referer: 'not a url' }],
    ['a look-alike host', { referer: 'https://app.acme.example.evil.example/' }],
  ])('returns null for %s', (_name, headers) => {
    expect(framedFrom(headers, ALLOWED)).toBeNull();
  });

  it('returns null when the workspace allows no site', () => {
    expect(framedFrom({ referer: 'https://app.acme.example/' }, [])).toBeNull();
  });
});
