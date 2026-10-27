import { VoiceClientMessageSchema, type VoiceServerMessage } from '@bookleaf/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import { startCall, type CallHandle, type CallerChannel } from '../../voice/call/controller.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { Session } from '../auth/session.js';
import type { VoiceService } from './service.js';

/** Largest audio frame accepted from the browser (~0.7 s of 24 kHz PCM16). */
export const MAX_FRAME_BYTES = 32 * 1024;

const OPEN = 1;

function channelFor(socket: WebSocket): CallerChannel {
  return {
    sendAudio: (pcm16) => {
      if (socket.readyState === OPEN) socket.send(pcm16, { binary: true });
    },
    send: (message: VoiceServerMessage) => {
      if (socket.readyState === OPEN) socket.send(JSON.stringify(message));
    },
    close: () => {
      if (socket.readyState === OPEN) socket.close(1000, 'call ended');
    },
  };
}

interface GatewayDeps {
  voice: VoiceService;
  provider: VoiceProvider;
  log: FastifyBaseLogger;
  now: () => Date;
}

/**
 * Bridges one browser socket to one call. Audio is relayed as binary frames; control messages
 * are JSON. Frames that arrive before the provider is ready are dropped (the browser waits for
 * "ready" before streaming). Failures end the call; they never reach other users.
 */
export async function bridgeCall(
  socket: WebSocket,
  session: Session,
  callId: string,
  deps: GatewayDeps,
) {
  let handle: CallHandle | null = null;
  let hungUpEarly = false;
  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      const frame = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (frame.length === 0 || frame.length % 2 !== 0 || frame.length > MAX_FRAME_BYTES) return;
      handle?.onCallerAudio(frame);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    const msg = VoiceClientMessageSchema.safeParse(parsed);
    if (msg.success && msg.data.type === 'hangup') {
      if (handle) handle.onCallerHangup();
      else hungUpEarly = true;
    }
  });
  socket.on('close', () => handle?.onCallerGone());

  let ctx: Awaited<ReturnType<VoiceService['claim']>>;
  try {
    ctx = await deps.voice.claim(session, callId);
  } catch {
    socket.close(4409, 'call not connectable');
    return;
  }
  handle = await startCall({
    provider: deps.provider,
    config: ctx.config,
    books: ctx.books,
    limits: deps.voice.callLimits(),
    caller: channelFor(socket),
    now: deps.now,
    isStillAllowed: () => deps.voice.isVoiceStillOn(),
    onEnd: (outcome) =>
      deps.voice
        .finish(callId, outcome, { facts: ctx.facts, ignorePhrases: ctx.ignorePhrases })
        .catch((err: unknown) => deps.log.error({ err, callId }, 'failed to save voice call')),
  });
  if (hungUpEarly) handle.onCallerHangup();
  else if (socket.readyState !== OPEN) handle.onCallerGone();
}
