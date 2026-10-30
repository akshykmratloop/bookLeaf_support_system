import { z } from 'zod';
import type { SharedState, SharedStateLog } from './types.js';

/** A typed broadcast to every copy: this copy's listeners hear it at once, others through pub/sub. */
export interface SharedChannel<T> {
  publish(message: T): void;
  listen(fn: (message: T) => void): () => void;
  /** Resolves once this copy hears the other copies (the subscription is in place). */
  ready: Promise<void>;
  close(): Promise<void>;
}

const Envelope = z.object({ from: z.string().min(1).max(64), data: z.unknown() });

function deliver<T>(listeners: Set<(m: T) => void>, message: T, log: SharedStateLog, name: string) {
  for (const fn of listeners) {
    try {
      fn(message);
    } catch (err) {
      log.error({ err: String(err), channel: name }, 'shared channel: a listener failed');
    }
  }
}

/**
 * Local listeners are called synchronously, exactly as before Redis; the message is also sent to
 * the other copies, which check it against `schema` (anything else is logged and dropped). A
 * copy ignores its own messages coming back from Redis.
 */
export function sharedChannel<T>(
  state: SharedState,
  name: string,
  schema: z.ZodType<T>,
  log: SharedStateLog,
): SharedChannel<T> {
  const listeners = new Set<(message: T) => void>();
  const onRemote = (raw: string) => {
    const envelope = Envelope.safeParse(parseJson(raw));
    if (envelope.success && envelope.data.from === state.instanceId) return;
    const parsed = envelope.success ? schema.safeParse(envelope.data.data) : envelope;
    if (!parsed.success)
      return log.warn({ channel: name }, 'shared channel: dropped a bad message');
    deliver(listeners, parsed.data, log, name);
  };
  const subscription = state.pubsub.subscribe(name, onRemote);
  const ready = subscription.then(() => undefined);
  // Startup awaits `ready` and refuses to start on failure; this only stops a second report.
  ready.catch(() => undefined);
  return {
    publish(message) {
      deliver(listeners, message, log, name);
      const raw = JSON.stringify({ from: state.instanceId, data: message });
      state.pubsub.publish(name, raw).catch((err: unknown) => {
        log.error({ err: String(err), channel: name }, 'shared channel: publish failed');
      });
    },
    listen(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    ready,
    close: async () => (await subscription)(),
  };
}

/** Not JSON at all reads as null, which the envelope check then reports as a bad message. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}
