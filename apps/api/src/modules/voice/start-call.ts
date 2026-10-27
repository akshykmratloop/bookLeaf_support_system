import type { StartVoiceCall } from '@bookleaf/shared';
import { AppError } from '../../platform/errors.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { Session } from '../auth/session.js';
import { newCallIds } from './call-setup.js';
import { authorIdOf, type VoiceDeps } from './deps.js';
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

interface NewCall {
  authorId: string;
  provider: VoiceProvider;
  resume: boolean;
  now: Date;
}

/** One call at a time per author: the lock makes the quota check and insert atomic. */
function insertCall(deps: VoiceDeps, { authorId, provider, resume, now }: NewCall) {
  const maxSeconds = deps.limits.voice.maxCallSeconds;
  return deps.db.$transaction(async (tx) => {
    await repo.lockAuthor(tx, authorId);
    await repo.replaceUnconnectedCalls(tx, authorId);
    await checkQuota(tx, deps.limits.voice, authorId, now);
    const ids = await newCallIds(tx, authorId, resume, now);
    const { id: providerId, model } = provider;
    return tx.voiceSession.create({
      data: { ...ids, authorId, provider: providerId, model, maxSeconds, createdAt: now },
    });
  });
}

/** Creates a PENDING call after the switch, provider and per-author limits all pass. */
export async function startCall(
  deps: VoiceDeps,
  session: Session,
  opts: { resume: boolean },
): Promise<StartVoiceCall> {
  await deps.assistant.requireVoiceEnabled();
  const authorId = authorIdOf(session);
  const provider = deps.provider;
  if (!provider) throw new VoiceUnavailableError();
  const now = deps.clock.now();
  const maxSeconds = deps.limits.voice.maxCallSeconds;
  await repo.expireStale(deps.db, authorId, now, maxSeconds);
  const call = await insertCall(deps, { authorId, provider, resume: opts.resume, now });
  return {
    id: call.id,
    socketPath: `/api/v1/voice/calls/${call.id}/stream`,
    maxSeconds,
    connectWithinSeconds: repo.CONNECT_WITHIN_SECONDS,
  };
}
