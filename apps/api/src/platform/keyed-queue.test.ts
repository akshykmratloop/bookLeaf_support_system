import { describe, expect, it } from 'vitest';
import { keyedQueue, QueueFullError } from './keyed-queue.js';

const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('keyedQueue', () => {
  it('runs tasks for the same key one at a time, in arrival order', async () => {
    const run = keyedQueue(10);
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await later(ms);
      log.push(`end ${name}`);
      return name;
    };
    const results = await Promise.all([run('a', task('1', 30)), run('a', task('2', 1))]);
    expect(results).toEqual(['1', '2']);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });

  it('runs different keys in parallel', async () => {
    const run = keyedQueue(10);
    const log: string[] = [];
    await Promise.all([
      run('a', async () => {
        log.push('a');
        await later(20);
      }),
      run('b', async () => {
        log.push('b');
        await later(1);
      }),
    ]);
    expect(log).toEqual(['a', 'b']);
  });

  it('keeps going after a failed task', async () => {
    const run = keyedQueue(10);
    const failing = run('a', async () => {
      throw new Error('boom');
    });
    const next = run('a', async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('refuses work beyond the waiting limit for one key', async () => {
    const run = keyedQueue(2);
    const slow = () => later(20);
    const first = run('a', slow);
    const second = run('a', slow);
    await expect(run('a', slow)).rejects.toBeInstanceOf(QueueFullError);
    await Promise.all([first, second]);
    await expect(run('a', async () => 'free again')).resolves.toBe('free again');
  });
});
