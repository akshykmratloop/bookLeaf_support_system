import type { StartVoiceCall } from '@bookleaf/shared';
import { AppError } from '../../platform/errors.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { newCallIds } from './call-setup.js';
import { joinableChat } from './chat-link.js';
import { type VoiceDeps } from './deps.js';
import { checkQuota } from './quota.js';
import * as repo from './repository.js';

class VoiceUnavailableError extends AppError {
  constructor() {
    super(
      503,
      'VOICE_UNAVAILABLE',
      'Voice calls are unavailable right now. You can use chat or raise a ticket.',
    );
  }
}

export interface StartOptions {
  resume: boolean;
  /** The chat this call joins (its context, its draft, its turn limit). */
  chatSessionId?: string;
}

interface NewCall extends StartOptions {
  authorId: string;
  provider: VoiceProvider;
  now: Date;
}

/**
 * One call at a time per author: the lock makes the quota check and insert atomic. A call that
 * joins a chat is a fresh thread: the chat already holds the earlier conversation.
 */
function insertCall(deps: VoiceDeps, { authorId, provider, resume, chatSessionId, now }: NewCall) {
  const maxSeconds = deps.limits.voice.maxCallSeconds;
  const maxTurns = deps.limits.chat.maxTurnsPerSession;
  return deps.db.$transaction(async (tx) => {
    await repo.lockAuthor(tx, authorId);
    const chatId = chatSessionId ? await joinableChat(tx, authorId, chatSessionId, maxTurns) : null;
    await repo.replaceUnconnectedCalls(tx, authorId);
    await checkQuota(tx, deps.limits.voice, authorId, now);
    const ids = await newCallIds(tx, authorId, resume && !chatId, now);
    const { id: providerId, model } = provider;
    return tx.voiceSession.create({
      data: {
        ...ids,
        authorId,
        chatSessionId: chatId,
        provider: providerId,
        model,
        maxSeconds,
        createdAt: now,
      },
    });
  });
}

/** Creates a PENDING call after the switch, provider and per-author limits all pass. */
export async function startCall(
  deps: VoiceDeps,
  session: Session,
  opts: StartOptions,
): Promise<StartVoiceCall> {
  await deps.assistant.requireVoiceEnabled();
  const authorId = authorIdOf(session);
  const provider = deps.provider;
  if (!provider) throw new VoiceUnavailableError();
  const now = deps.clock.now();
  const maxSeconds = deps.limits.voice.maxCallSeconds;
  await repo.expireStale(deps.db, authorId, now, maxSeconds);
  const call = await insertCall(deps, { ...opts, authorId, provider, now });
  return {
    id: call.id,
    socketPath: `/api/v1/voice/calls/${call.id}/stream`,
    maxSeconds,
    connectWithinSeconds: repo.CONNECT_WITHIN_SECONDS,
  };
}
