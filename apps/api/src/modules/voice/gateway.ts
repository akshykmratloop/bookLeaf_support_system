import { VoiceClientMessageSchema, type VoiceServerMessage } from '@bookleaf/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { startCall, type CallHandle, type CallerChannel } from '../../voice/call/controller.js';
import type { CallOutcome } from '../../voice/call/types.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { AppError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { audioBudget } from './audio-budget.js';
import type { CallContext } from './context.js';
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

/** The caller's socket before and after the call is live. */
interface Line {
  handle: CallHandle | null;
  hungUpEarly: boolean;
}

function isHangup(data: RawData): boolean {
  try {
    const msg = VoiceClientMessageSchema.safeParse(JSON.parse(data.toString()));
    return msg.success && msg.data.type === 'hangup';
  } catch {
    return false; // not JSON: ignore the frame, the call goes on
  }
}

/** Audio frames are size-checked and rate-limited; anything else may only be "hangup". */
function listen(socket: WebSocket, line: Line): void {
  const accept = audioBudget();
  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      const frame = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (frame.length === 0 || frame.length % 2 !== 0 || frame.length > MAX_FRAME_BYTES) return;
      if (accept(frame.length)) line.handle?.onCallerAudio(frame);
      return;
    }
    if (!isHangup(data)) return;
    if (line.handle) line.handle.onCallerHangup();
    else line.hungUpEarly = true;
  });
  socket.on('close', () => line.handle?.onCallerGone());
}

/** Saves the outcome; if that fails, the call is at least released so the author can retry. */
function saver(callId: string, ctx: CallContext, deps: GatewayDeps) {
  return async (outcome: CallOutcome) => {
    try {
      await deps.voice.finish(callId, outcome, ctx);
    } catch (err) {
      deps.log.error({ err, callId }, 'failed to save voice call');
      await deps.voice.markFailed(callId);
    }
  };
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
  const line: Line = { handle: null, hungUpEarly: false };
  listen(socket, line);
  let ctx: CallContext;
  try {
    ctx = await deps.voice.claim(session, callId);
  } catch (err) {
    if (!(err instanceof AppError)) deps.log.error({ err, callId }, 'voice call setup failed');
    socket.close(4409, 'call not connectable');
    return;
  }
  line.handle = await startCall({
    provider: deps.provider,
    config: ctx.config,
    draft: deps.voice.draftPort(session, ctx),
    limits: { ...deps.voice.callLimits(), turnsLeft: ctx.turnsLeft },
    caller: channelFor(socket),
    now: deps.now,
    isStillAllowed: () => deps.voice.isVoiceStillOn(),
    onEnd: saver(callId, ctx, deps),
    lines: ctx.lines,
    warn: (message, err) => deps.log.warn({ err, callId }, message),
  });
  if (line.hungUpEarly) line.handle.onCallerHangup();
  else if (socket.readyState !== OPEN) line.handle.onCallerGone();
}
