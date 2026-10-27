import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { DEFAULT_WORKSPACE_ID } from '../../src/modules/workspaces/constants.js';
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
import { loadEnv } from '../../src/config/index.js';
import { buildHostApp, findByEmail, loadAuthors, mintSupportToken } from '@bookleaf/host-demo';

export const ORIGIN = 'http://localhost:5173';
/** The demo host the support module is attached to in tests: a real HTTP server, not a mock. */
export const HOST = {
  apiKey: 'integration-test-host-api-key-123456',
  signingSecret: 'integration-test-host-signing-secret-123456',
};
const HOST_AUTHORS = loadAuthors();
export const ADMIN_PASSWORD = 'Admin@Test1';
export const SENTINEL_KEY = 'sk-ant-SENTINEL-123';
/** 32 zero bytes, base64: fine for tests, never for a real deployment. */
export const TEST_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
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

/** The chat model leaves the ticket draft alone. */
export const NO_DRAFT = {
  action: 'none',
  category: null,
  bookId: null,
  subject: null,
  description: null,
} as const;

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
      draft: NO_DRAFT,
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
  /** Admins sign in with a password; authors arrive from the host with a hand-over token. */
  login(email: string, password?: string): Promise<string>;
  /** Base URL of the running demo host. */
  hostUrl: string;
  /** Stops the demo host, to test what happens when the product is down. */
  stopHost(): Promise<void>;
  drain(max?: number): Promise<number>;
  close(): Promise<void>;
}

async function startHost() {
  const host = await buildHostApp(
    {
      HOST_DEMO_PORT: 0,
      SUPPORT_URL: ORIGIN,
      HOST_API_KEY: HOST.apiKey,
      HOST_SIGNING_SECRET: HOST.signingSecret,
      DATA_AS_OF: '2025-12-31',
      HOST_DEMO_PASSWORD: 'Author@Test1',
      HOST_WEB_DIST: '/nonexistent/host-web-dist',
    },
    HOST_AUTHORS,
  );
  return { host, url: await host.listen({ port: 0, host: '127.0.0.1' }) };
}

function passwordLogin(app: FastifyInstance, email: string, password?: string) {
  const pw = password ?? ADMIN_PASSWORD;
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: pw },
  });
}

/** The hand-over token the demo host mints when this author opens support. */
export async function hostTokenFor(email: string): Promise<string> {
  const account = findByEmail(HOST_AUTHORS, email);
  if (!account) throw new Error(`no demo author ${email}`);
  return mintSupportToken(account, HOST.signingSecret);
}

/** What the demo host's "Open support" button does: mint a hand-over token, exchange it. */
async function hostLogin(app: FastifyInstance, email: string) {
  const token = await hostTokenFor(email);
  return app.inject({ method: 'POST', url: '/api/v1/auth/host', payload: { token } });
}

export interface HarnessOptions {
  voice?: boolean;
  /** Extra settings, e.g. HOST_ORIGINS for embed mode. */
  env?: Record<string, string>;
  /** Keep BookLeaf's saved settings from earlier in the file (a second harness mid-file). */
  keepSettings?: boolean;
}

export async function createHarness(opts: HarnessOptions = {}): Promise<Harness> {
  const { host, url: hostUrl } = await startHost();
  const env = loadEnv({
    NODE_ENV: 'test',
    APP_ORIGIN: ORIGIN,
    DATABASE_URL: inject('databaseUrl'),
    JWT_SECRET: 'integration-test-secret-that-is-long-enough-123',
    DATA_AS_OF: '2025-12-31',
    ANTHROPIC_API_KEY: SENTINEL_KEY,
    WORKER_ENABLED: 'false',
    HOST_API_URL: hostUrl,
    HOST_API_KEY: HOST.apiKey,
    HOST_SIGNING_SECRET: HOST.signingSecret,
    // Workspace secrets are encrypted with a throwaway master key; the demo host is local.
    SECRETS_MASTER_KEY: TEST_MASTER_KEY,
    CONNECTOR_ALLOW_PRIVATE_HOSTS: 'true',
    ...opts.env,
  });
  const db = createDb(env.DATABASE_URL);
  // Files share one database: start BookLeaf's saved settings again from this file's env.
  if (!opts.keepSettings)
    await db.workspaceSettings.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
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
    {
      db,
      ai: container.ai,
      clock,
      events: container.events,
      records: container.records,
      log: silent,
    },
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
    hostUrl,
    stopHost: () => host.close(),
    setAi: (h) => {
      handler = h;
    },
    async login(email, password) {
      // A password means a staff account (any workspace); demo admins keep their default.
      const isAdmin = password !== undefined || email.endsWith('@bookleaf.demo');
      const res = isAdmin ? await passwordLogin(app, email, password) : await hostLogin(app, email);
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
      await host.close();
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
  const b = await h.db.book.findFirstOrThrow({ where: { externalId } });
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

/** Removes a workspace created by a test and every row in it (files share one database). */
export async function deleteWorkspace(db: Db, slug: string): Promise<void> {
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) return;
  const workspaceId = ws.id;
  const tickets = await db.ticket.findMany({ where: { workspaceId }, select: { id: true } });
  const ticketIds = tickets.map((t) => t.id);
  await db.$transaction([
    db.ticketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    db.aiJob.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    db.aiDraft.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    db.aiRun.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    db.ticketDraft.deleteMany({ where: { workspaceId } }),
    db.ticket.deleteMany({ where: { workspaceId } }),
    db.chatSession.deleteMany({ where: { workspaceId } }),
    db.voiceSession.deleteMany({ where: { workspaceId } }),
    db.book.deleteMany({ where: { workspaceId } }),
    db.author.deleteMany({ where: { workspaceId } }),
    db.auditEvent.deleteMany({ where: { workspaceId } }),
    db.workspaceMember.deleteMany({ where: { workspaceId } }),
    db.workspaceConnector.deleteMany({ where: { workspaceId } }),
    db.customerField.deleteMany({ where: { workspaceId } }),
    db.workspaceSettings.deleteMany({ where: { workspaceId } }),
    db.workspaceApiKey.deleteMany({ where: { workspaceId } }),
    db.user.deleteMany({ where: { workspaceId } }),
    db.workspace.delete({ where: { id: workspaceId } }),
  ]);
}
