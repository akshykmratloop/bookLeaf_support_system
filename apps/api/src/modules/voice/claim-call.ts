import type { Fact } from '@bookleaf/shared';
import { ConflictError } from '../../platform/errors.js';
import type { CallLimits, CallOutcome } from '../../voice/call/controller.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { contextFor } from './call-setup.js';
import type { CallContext } from './context.js';
import { type VoiceDeps } from './deps.js';
import { finishCall } from './finish.js';
import * as repo from './repository.js';

/** Socket connected: the call moves PENDING → ACTIVE exactly once, within the connect window. */
export async function claimCall(
  deps: VoiceDeps,
  session: Session,
  id: string,
): Promise<CallContext> {
  const authorId = authorIdOf(session);
  const now = deps.clock.now();
  const res = await deps.db.voiceSession.updateMany({
    where: {
      id,
      authorId,
      status: 'PENDING',
      createdAt: { gte: new Date(now.getTime() - repo.CONNECT_WITHIN_SECONDS * 1000) },
    },
    data: { status: 'ACTIVE', startedAt: now },
  });
  if (res.count !== 1)
    throw new ConflictError(
      'VOICE_CALL_NOT_CONNECTABLE',
      'This call has expired or is already connected.',
    );
  try {
    return await contextFor(deps, authorId, id, deps.limits.voice.maxCallSeconds);
  } catch (err) {
    // The row is already ACTIVE: release it so the author is not blocked until it expires.
    await repo.markCallFailed(deps.db, id, deps.clock.now());
    throw err;
  }
}

/** Rules the live call enforces; the hard cap comes from env (at most 300 s). */
export function callLimits(deps: VoiceDeps): CallLimits {
  return {
    maxSeconds: deps.limits.voice.maxCallSeconds,
    warnBeforeEndSeconds: 30,
    idleSeconds: 45,
    recheckSeconds: 15,
    goodbyeSeconds: 8,
  };
}

export interface EndedCall {
  callId: string;
  outcome: CallOutcome;
  facts: Fact[];
  ignorePhrases: string[];
}

/** Saves the transcript, the spoken-figure check and the AI run of a finished call. */
export async function saveCallOutcome(deps: VoiceDeps, { callId, outcome, ...ctx }: EndedCall) {
  await finishCall(deps.db, {
    callId,
    providerId: deps.provider?.id ?? 'unknown',
    model: deps.provider?.model ?? 'unknown',
    outcome,
    ...ctx,
  });
}
