import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { AssistantSettings, StartVoiceCall, VoiceServerMessage } from '@bookleaf/shared';
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

/** Opens the socket on this test server, using the path and ticket from the public URL. */
function open(socketUrl: string, headers: Record<string, string>): Opened {
  const { pathname, search } = new URL(socketUrl);
  const ws = new WebSocket(`${base}${pathname}${search}`, { headers });
  ws.on('error', () => undefined);
  const ready = new Promise<boolean>((resolve) => {
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      if ((JSON.parse(data.toString()) as VoiceServerMessage).type === 'ready') resolve(true);
    });
    ws.on('close', () => resolve(false));
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
  it('returns the public socket URL with a ticket', async () => {
    const started = await start(priya);
    expect(started.socketUrl).toMatch(
      new RegExp(`^${PUBLIC_WS}/api/v1/voice/calls/${started.id}/stream\\?ticket=[^&]+$`),
    );
    open(started.socketUrl ?? '', { origin: ORIGIN }).close();
    await settle();
  });

  it('opens the call with the ticket alone, and the same ticket never works twice', async () => {
    const started = await start(priya);
    const url = started.socketUrl ?? '';
    const first = open(url, { origin: ORIGIN });
    expect(await first.ready).toBe(true);
    first.close();
    await settle();
    const replay = open(url, { origin: ORIGIN });
    expect(await replay.ready).toBe(false);
  });

  it('refuses a ticket from another site (Origin)', async () => {
    const started = await start(kavita);
    const foreign = open(started.socketUrl ?? '', { origin: 'https://evil.example' });
    expect(await foreign.ready).toBe(false);
  });

  it("cannot open someone else's call with your ticket", async () => {
    const mine = await start(priya);
    const theirs = await start(kavita);
    const ticket = new URL(mine.socketUrl ?? '').search;
    const stolen = open(`${PUBLIC_WS}/api/v1/voice/calls/${theirs.id}/stream${ticket}`, {
      origin: ORIGIN,
    });
    expect(await stolen.ready).toBe(false);
  });
});
