import { describe, expect, it } from 'vitest';

/**
 * After merging U-7 (platform console), U-9 (data sources), U-10 (webhooks) and U-11 (API keys):
 * every sidebar entry still exists and points at a route that is registered.
 */
const read = (files: Record<string, string>) => Object.values(files).join('\n');
const SHELLS = import.meta.glob<string>(['../components/templates/*Shell.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const ROUTES = import.meta.glob<string>(['../app/*Routes.tsx', '../app/App.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const navTargets = (text: string) => [...text.matchAll(/\bto: '([^']+)'/g)].map((m) => m[1]);
const routePaths = (text: string) =>
  new Set([...text.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));

const STAFF_NAV = [
  '/admin',
  '/admin/assistant',
  '/admin/workspace/connection',
  '/admin/workspace/fields',
  '/admin/workspace/categories',
  '/admin/workspace/knowledge',
  '/admin/workspace/settings',
  '/admin/workspace/api-keys',
  '/admin/workspace/webhooks',
];
const PLATFORM_NAV = ['/platform', '/platform/ai'];

describe('sidebar navigation', () => {
  const targets = navTargets(read(SHELLS));
  const paths = routePaths(read(ROUTES));

  it('keeps every staff and platform entry, each once, in order', () => {
    expect(targets).toEqual([...STAFF_NAV, ...PLATFORM_NAV]);
  });

  it('points every entry at a registered route', () => {
    expect(targets.filter((to) => !paths.has(to))).toEqual([]);
  });

  it('puts Webhooks right under API Keys', () => {
    expect(targets.indexOf('/admin/workspace/webhooks')).toBe(
      targets.indexOf('/admin/workspace/api-keys') + 1,
    );
  });
});
