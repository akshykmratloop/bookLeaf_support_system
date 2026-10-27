import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveProviderKey } from './providerKeys';

afterEach(() => vi.unstubAllGlobals());

describe('saveProviderKey', () => {
  it('puts the key to its capability path and leaves the capability out of the body', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ capability: 'AI', provider: 'anthropic', last4: '1234' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await saveProviderKey({ capability: 'AI', provider: 'anthropic', apiKey: 'sk-test-1234' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/workspace/provider-keys/AI');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-test-1234',
    });
  });
});
