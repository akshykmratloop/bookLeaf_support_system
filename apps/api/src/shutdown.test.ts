import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdown, guardProcess, type ShutdownLog } from './shutdown.js';

const silentLog = (): ShutdownLog & { errors: string[]; fatals: string[] } => {
  const errors: string[] = [];
  const fatals: string[] = [];
  return {
    errors,
    fatals,
    info: () => undefined,
    error: (_d, m) => void errors.push(m),
    fatal: (_d, m) => void fatals.push(m),
  };
};

afterEach(() => vi.useRealTimers());

describe('shutdown', () => {
  it('closes once and exits with the given code', async () => {
    const close = vi.fn(async () => undefined);
    const exit = vi.fn();
    const shutdown = createShutdown({ log: silentLog(), close, exit });
    await Promise.all([shutdown('SIGTERM', 0), shutdown('SIGINT', 0)]);
    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits with 1 when closing fails', async () => {
    const exit = vi.fn();
    const log = silentLog();
    const shutdown = createShutdown({ log, close: () => Promise.reject(new Error('db')), exit });
    await shutdown('SIGTERM', 0);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.errors).toContain('shutdown failed');
  });

  it('forces the exit when closing hangs past the limit', async () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const shutdown = createShutdown({
      log: silentLog(),
      close: () => new Promise(() => undefined),
      exit,
      limitMs: 1000,
    });
    void shutdown('SIGTERM', 0);
    await vi.advanceTimersByTimeAsync(999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('process guards', () => {
  it('logs an unhandled rejection and keeps serving', () => {
    const proc = new EventEmitter();
    const log = silentLog();
    const shutdown = vi.fn(async () => undefined);
    guardProcess(proc, log, shutdown);
    proc.emit('unhandledRejection', new Error('lost promise'));
    expect(log.errors).toEqual(['unhandled promise rejection']);
    expect(shutdown).not.toHaveBeenCalled();
  });

  it('logs an uncaught exception and shuts down with exit code 1', () => {
    const proc = new EventEmitter();
    const log = silentLog();
    const shutdown = vi.fn(async () => undefined);
    guardProcess(proc, log, shutdown);
    proc.emit('uncaughtException', new Error('boom'));
    expect(log.fatals).toEqual(['uncaught exception']);
    expect(shutdown).toHaveBeenCalledWith('uncaughtException', 1);
  });

  it('shuts down cleanly on SIGTERM', () => {
    const proc = new EventEmitter();
    const shutdown = vi.fn(async () => undefined);
    guardProcess(proc, silentLog(), shutdown);
    proc.emit('SIGTERM');
    expect(shutdown).toHaveBeenCalledWith('SIGTERM', 0);
  });
});
