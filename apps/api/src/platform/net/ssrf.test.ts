import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isPrivateIp, UnsafeUrlError } from './ssrf.js';

const strict = { requireHttps: true, allowPrivateHosts: false };
const dev = { requireHttps: false, allowPrivateHosts: true };

describe('private address detection', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd12::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    '192.0.0.9',
    '198.18.0.1',
    '198.19.255.1',
    '192.0.2.1',
    '198.51.100.7',
    '203.0.113.5',
    '::ffff:7f00:1',
    'ff02::1',
    '64:ff9b::a00:1',
  ])('%s is private', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111'])('%s is public', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('refuses http when https is required', async () => {
    await expect(assertSafeUrl('http://example.com', strict)).rejects.toThrow(UnsafeUrlError);
  });

  it('refuses non-web schemes and embedded credentials', async () => {
    await expect(assertSafeUrl('ftp://example.com', dev)).rejects.toThrow(/only http/);
    await expect(assertSafeUrl('https://user:pw@example.com', strict)).rejects.toThrow(
      /credentials/,
    );
  });

  it('refuses literal private addresses and local names', async () => {
    await expect(assertSafeUrl('https://169.254.169.254/latest', strict)).rejects.toThrow(
      /private/,
    );
    await expect(assertSafeUrl('https://[::1]/', strict)).rejects.toThrow(/private/);
    await expect(assertSafeUrl('https://localhost/', strict)).rejects.toThrow(/local host/);
    await expect(assertSafeUrl('https://api.internal.local/', strict)).rejects.toThrow(
      /local host/,
    );
  });

  it('allows a public literal address', async () => {
    const url = await assertSafeUrl('https://1.1.1.1/support', strict);
    expect(url.hostname).toBe('1.1.1.1');
  });

  it('lets development reach localhost over http', async () => {
    const url = await assertSafeUrl('http://localhost:3200', dev);
    expect(url.origin).toBe('http://localhost:3200');
  });
});
