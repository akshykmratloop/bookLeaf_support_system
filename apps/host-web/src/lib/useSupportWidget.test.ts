import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOutOfHelp } from './useSupportWidget';

afterEach(() => vi.unstubAllGlobals());

describe('signing out of help with the host', () => {
  it('waits for the widget to sign its own session out', async () => {
    let finished = false;
    const signOut = vi.fn(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            finished = true;
            resolve();
          }, 10),
        ),
    );
    vi.stubGlobal('window', { BookLeafSupport: { open: vi.fn(), expand: vi.fn(), signOut } });
    await signOutOfHelp();
    expect(signOut).toHaveBeenCalledOnce();
    expect(finished).toBe(true);
  });

  it('carries on when the widget is not loaded, or is an older script without signOut', async () => {
    vi.stubGlobal('window', {});
    await expect(signOutOfHelp()).resolves.toBeUndefined();
    vi.stubGlobal('window', { BookLeafSupport: { open: vi.fn(), expand: vi.fn() } });
    await expect(signOutOfHelp()).resolves.toBeUndefined();
  });
});
