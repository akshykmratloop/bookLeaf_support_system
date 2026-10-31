/**
 * State that every copy of the API must see the same way (F-19). The core depends only on these
 * interfaces; `registry.ts` picks the backend once at startup (Redis in production and local
 * development, in memory only for unit tests). Every key and channel lives under one prefix.
 */

/** Stops a subscription. */
export type Unsubscribe = () => Promise<void>;

/** Fire-and-forget messages that reach every copy subscribed to the channel. */
export interface PubSub {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, onMessage: (message: string) => void): Promise<Unsubscribe>;
}

/** One-use markers, e.g. a sign-in token id that may be redeemed once on the whole platform. */
export interface OneTimeClaims {
  /** True the first time `key` is claimed; false while an earlier claim is still alive. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
}

export interface WindowCount {
  /** Hits in the current window, this one included. */
  count: number;
  /** Milliseconds until the window ends and the count starts again. */
  resetInMs: number;
}

/** Shared request counters for rate limits: a fixed window that starts with the first hit. */
export interface RateCounters {
  hit(key: string, windowMs: number): Promise<WindowCount>;
  /** Forgets the count for `key` on every copy; the next hit starts a new window. */
  clear(key: string): Promise<void>;
}

/** Runs tasks with the same key one at a time, in arrival order; other keys run in parallel. */
export type KeyedQueue = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export interface KeyedQueues {
  /**
   * The queue called `name`, shared by every copy. More than `maxWaiting` tasks (running or
   * waiting) for one key are refused with QueueFullError.
   */
  create(name: string, maxWaiting: number): KeyedQueue;
}

export interface SharedState {
  /** Which backend runs it, for the startup log. */
  readonly backend: 'redis' | 'memory';
  /** Unique per running copy, so a copy can skip the messages it sent itself. */
  readonly instanceId: string;
  pubsub: PubSub;
  claims: OneTimeClaims;
  counters: RateCounters;
  queues: KeyedQueues;
  /** Resolves once the backend answers; throws SharedStateUnavailableError when it cannot. */
  ready(): Promise<void>;
  close(): Promise<void>;
}

/** Where shared-state problems are reported (the app logger, or stderr before it exists). */
export interface SharedStateLog {
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}
