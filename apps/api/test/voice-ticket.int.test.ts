import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  VOICE_SOCKET_PROTOCOL,
  VOICE_TICKET_PROTOCOL_PREFIX,
  type AssistantSettings,
  type StartVoiceCall,
  type VoiceServerMessage,
} from '@bookleaf/shared';
import { call, createHarness, EMAILS, ORIGIN, type Harness } from './helpers/app.js';

/** Where the browser reaches the API directly when the web app is served from another site. */
const PUBLIC_WS = 'wss://api.demo.example';

let h: Harness;
let base: string;
let priya: string;
let kavita: string;

interface Opened {
  ready: Promise<boolean>;
  close(): void;
}

/** The subprotocols the web app offers: the app's own, plus the one-time ticket. */
const protocols = (ticket: string | undefined) => [
  VOICE_SOCKET_PROTOCOL,
  ...(ticket ? [`${VOICE_TICKET_PROTOCOL_PREFIX}${ticket}`] : []),
];

/** Opens the socket on this test server at the public URL's path, offering the ticket. */
function open(
  socketUrl: string,
  ticket: string | undefined,
  headers: Record<string, string>,
): Opened {
  const { pathname, search } = new URL(socketUrl);
  const ws = new WebSocket(`${base}${pathname}${search}`, protocols(ticket), { headers });
  ws.on('error', () => undefined);
  const ready = new Promise<boolean>((resolve) => {
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      if ((JSON.parse(data.toString()) as VoiceServerMessage).type === 'ready') resolve(true);
    });
    ws.on('close', () => resolve(false));
    ws.on('error', () => resolve(false));
  });
  return {
    ready,
    close: () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'hangup' }));
      ws.close();
    },
  };
}

async function start(cookie: string): Promise<StartVoiceCall> {
  const res = await call(h, 'POST', '/voice/calls', cookie);
  expect(res.statusCode).toBe(201);
  return res.json<StartVoiceCall>();
}

const settle = () => new Promise((r) => setTimeout(r, 200));

beforeAll(async () => {
  h = await createHarness({ env: { PUBLIC_API_WS_ORIGIN: PUBLIC_WS } });
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  base = `ws://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
  const admin = await h.login(EMAILS.admin);
  [priya, kavita] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.kavita)]);
  // Calls made by earlier test files count against these authors' hourly call quota; this file
  // starts several calls, so it starts from none.
  await h.db.voiceSession.deleteMany({
    where: { author: { user: { email: { in: [EMAILS.priya, EMAILS.kavita] } } } },
  });
  const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
    settings: AssistantSettings;
  }>();
  await call(h, 'PUT', '/admin/assistant/settings', admin, {
    version: settings.version,
    voiceEnabled: true,
  });
});
afterAll(() => h.close());

describe('voice: one-time ticket for the call socket (web app on another site)', () => {
  it('returns the public socket URL without the ticket, and the ticket on its own', async () => {
    const started = await start(priya);
    expect(started.socketUrl).toBe(`${PUBLIC_WS}/api/v1/voice/calls/${started.id}/stream`);
    expect(started.socketTicket).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    open(started.socketUrl ?? '', started.socketTicket, { origin: ORIGIN }).close();
    await settle();
  });

  it('opens the call with the ticket alone (as a subprotocol), and never twice', async () => {
    const started = await start(priya);
    const url = started.socketUrl ?? '';
    const first = open(url, started.socketTicket, { origin: ORIGIN });
    expect(await first.ready).toBe(true);
    first.close();
    await settle();
    const replay = open(url, started.socketTicket, { origin: ORIGIN });
    expect(await replay.ready).toBe(false);
  });

  it('answers with the bookleaf.v1 subprotocol, never echoing the ticket', async () => {
    const started = await start(priya);
    const { pathname } = new URL(started.socketUrl ?? '');
    const ws = new WebSocket(`${base}${pathname}`, protocols(started.socketTicket), {
      headers: { origin: ORIGIN },
    });
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        if ((JSON.parse(data.toString()) as VoiceServerMessage).type === 'ready') resolve();
      });
      ws.once('error', reject);
    });
    expect(ws.protocol).toBe(VOICE_SOCKET_PROTOCOL);
    ws.send(JSON.stringify({ type: 'hangup' }));
    ws.close();
    await settle();
  });

  it('no longer reads a ticket from the URL', async () => {
    const started = await start(priya);
    const url = `${started.socketUrl ?? ''}?ticket=${started.socketTicket ?? ''}`;
    const viaQuery = open(url, undefined, { origin: ORIGIN });
    expect(await viaQuery.ready).toBe(false);
  });

  it('refuses a ticket issued before the author signed out', async () => {
    const started = await start(kavita);
    expect((await call(h, 'POST', '/auth/logout', kavita)).statusCode).toBe(204);
    const afterLogout = open(started.socketUrl ?? '', started.socketTicket, { origin: ORIGIN });
    expect(await afterLogout.ready).toBe(false);
    kavita = await h.login(EMAILS.kavita);
  });

  it('refuses a ticket from another site (Origin)', async () => {
    const started = await start(kavita);
    const foreign = open(started.socketUrl ?? '', started.socketTicket, {
      origin: 'https://evil.example',
    });
    expect(await foreign.ready).toBe(false);
  });

  it("cannot open someone else's call with your ticket", async () => {
    const mine = await start(priya);
    const theirs = await start(kavita);
    const stolen = open(`${PUBLIC_WS}/api/v1/voice/calls/${theirs.id}/stream`, mine.socketTicket, {
      origin: ORIGIN,
    });
    expect(await stolen.ready).toBe(false);
  });
});
