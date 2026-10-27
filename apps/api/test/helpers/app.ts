import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { inject } from 'vitest';
import { createWorker, type Worker } from '../../src/ai/jobs/worker.js';
import { fakeProvider, type FakeHandler } from '../../src/ai/providers/fake/provider.js';
import type { StructuredRequest } from '../../src/ai/providers/types.js';
import {
  fakeVoiceProvider,
  type FakeVoiceProvider,
} from '../../src/voice/providers/fake/provider.js';
import { buildApp } from '../../src/app.js';
import { createContainer, type Container } from '../../src/container.js';
import type { Clock } from '../../src/platform/clock.js';
import { createDb, type Db } from '../../src/platform/db.js';
import { loadEnv } from '../../src/platform/env.js';

export const ORIGIN = 'http://localhost:5173';
export const AUTHOR_PASSWORD = 'Author@Test1';
export const ADMIN_PASSWORD = 'Admin@Test1';
export const SENTINEL_KEY = 'sk-ant-SENTINEL-123';
export const EMAILS = {
  priya: 'priya.sharma@email.com',
  rohit: 'rohit.kapoor@email.com',
  arjun: 'arjun.malhotra@email.com',
  kavita: 'kavita.deshmukh@email.com',
  admin: 'admin@bookleaf.demo',
  admin2: 'ops2@bookleaf.demo',
} as const;

/** Real wall clock plus an offset tests can advance (to make retry backoff due). */
export interface TestClock extends Clock {
  advance(ms: number): void;
}

function testClock(dataAsOf: string): TestClock {
  let offset = 0;
  const asOf = new Date(`${dataAsOf}T00:00:00.000Z`);
  return {
    now: () => new Date(Date.now() + offset),
    dataAsOf: () => new Date(asOf.getTime()),
    advance: (ms) => {
      offset += ms;
    },
  };
}

/** A fake AI that answers plausibly unless a test swaps the handler. */
export function defaultHandler(req: StructuredRequest<unknown>): unknown {
  if (req.task === 'TRIAGE') {
    return {
      category: 'ROYALTY_PAYMENTS',
      priority: 'MEDIUM',
      priorityReasons: ['royalty question'],
      needsInfo: [],
      confidence: 'high',
    };
  }
  if (req.task === 'DRAFT') {
    return {
      body: 'Hi there,\n\nThank you for reaching out. We are checking this with our team.\n\nWarm regards,\nBookLeaf Author Support',
      claims: [],
    };
  }
  if (req.task === 'CHAT') {
    return {
      answer: 'Happy to help with questions about your books, royalties and payouts.',
      claims: [],
      ticketSuggestion: null,
    };
  }
  return { ok: true };
}

export interface Harness {
  app: FastifyInstance;
  db: Db;
  container: Container;
  clock: TestClock;
  worker: Worker;
  setAi(handler: FakeHandler): void;
  aiCalls: StructuredRequest<unknown>[];
  /** Simulated speech-to-speech provider (null when created with { voice: false }). */
  voice: FakeVoiceProvider | null;
  login(email: string, password?: string): Promise<string>;
  drain(max?: number): Promise<number>;
  close(): Promise<void>;
}

export async function createHarness(opts: { voice?: boolean } = {}): Promise<Harness> {
  const env = loadEnv({
    NODE_ENV: 'test',
    APP_ORIGIN: ORIGIN,
    DATABASE_URL: inject('databaseUrl'),
    JWT_SECRET: 'integration-test-secret-that-is-long-enough-123',
    DATA_AS_OF: '2025-12-31',
    ANTHROPIC_API_KEY: SENTINEL_KEY,
    WORKER_ENABLED: 'false',
  });
  const db = createDb(env.DATABASE_URL);
  const clock = testClock(env.DATA_AS_OF);
  let handler: FakeHandler = defaultHandler;
  const provider = fakeProvider((req) => handler(req));
  const voice = opts.voice === false ? null : fakeVoiceProvider();
  const container = createContainer(env, {
    db,
    clock,
    providers: new Map([['anthropic', provider]]),
    voiceProvider: voice,
  });
  const app = await buildApp(container);
  await app.ready();
  const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
  const worker = createWorker(
    { db, ai: container.ai, clock, events: container.events, log: silent },
    { pollMs: 10 },
  );
  return {
    app,
    db,
    container,
    clock,
    worker,
    aiCalls: provider.calls,
    voice,
    setAi: (h) => {
      handler = h;
    },
    async login(email, password) {
      const pw = password ?? (email.endsWith('@bookleaf.demo') ? ADMIN_PASSWORD : AUTHOR_PASSWORD);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: pw },
      });
      if (res.statusCode !== 200) throw new Error(`login failed for ${email}: ${res.statusCode}`);
      const cookie = res.cookies.find((c) => c.name === 'bl_session');
      if (!cookie) throw new Error('no session cookie');
      return `bl_session=${cookie.value}`;
    },
    async drain(max = 50) {
      let n = 0;
      while (n < max && (await worker.runOnce())) n += 1;
      return n;
    },
    async close() {
      await app.close();
      await db.$disconnect();
    },
  };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function call(
  h: Harness,
  method: Method,
  url: string,
  cookie?: string,
  payload?: unknown,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return h.app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { ...(cookie ? { cookie } : {}), ...headers },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

export async function bookId(h: Harness, externalId: string): Promise<string> {
  const b = await h.db.book.findUniqueOrThrow({ where: { externalId } });
  return b.id;
}

export async function createTicket(
  h: Harness,
  cookie: string,
  body: { bookId: string | null; subject: string; description: string },
  key?: string,
) {
  const res = await call(
    h,
    'POST',
    '/tickets',
    cookie,
    body,
    key ? { 'idempotency-key': key } : {},
  );
  return res;
}
