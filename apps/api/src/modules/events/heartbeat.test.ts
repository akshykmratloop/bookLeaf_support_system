import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, WorkspaceSuspendedError } from '../../platform/errors.js';
import { heartbeat, type Stream } from './routes.js';

function fakeStream() {
  const written: string[] = [];
  const end = vi.fn();
  const stream = {
    write: (chunk: string) => {
      written.push(chunk);
      return true;
    },
    end,
  } as unknown as Stream;
  return { stream, written, end };
}

const log = () => ({ warn: vi.fn() });

describe('live updates heartbeat', () => {
  it('pings while the session is valid', async () => {
    const { stream, written, end } = fakeStream();
    const stop = vi.fn();
    await heartbeat(stream, () => Promise.resolve(), stop, log());
    expect(written).toEqual([': ping\n\n']);
    expect(stop).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it.each([
    ['signed out or expired', new UnauthorizedError()],
    ['workspace suspended', new WorkspaceSuspendedError()],
  ])('ends the stream with session-expired when %s', async (_label, err) => {
    const { stream, written, end } = fakeStream();
    const stop = vi.fn();
    await heartbeat(stream, () => Promise.reject(err), stop, log());
    expect(written).toEqual(['event: session-expired\ndata: {}\n\n']);
    expect(stop).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });

  it('skips the ping, keeps the stream and warns when the check itself fails', async () => {
    const { stream, written, end } = fakeStream();
    const stop = vi.fn();
    const l = log();
    await heartbeat(stream, () => Promise.reject(new Error('db timeout')), stop, l);
    expect(written).toEqual([]);
    expect(stop).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    expect(l.warn).toHaveBeenCalledOnce();
  });
});
