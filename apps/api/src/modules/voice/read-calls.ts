import type { AdminVoiceCall, VoiceCall } from '@bookleaf/shared';
import { authorIdOf, type Session } from '../auth/session.js';
import { threadDraft } from './call-setup.js';
import { type VoiceDeps } from './deps.js';
import { toAdminVoiceCall, toVoiceCall } from './mappers.js';
import * as repo from './repository.js';
import { findResumable, threadLines, threadOf } from './thread.js';

export async function getCall(deps: VoiceDeps, session: Session, id: string): Promise<VoiceCall> {
  const call = await repo.findOwnCall(deps.db, id, authorIdOf(session));
  return toVoiceCall(call, await threadDraft(deps.db, threadOf(call)));
}

/** The author's last call if it can be continued (ended < 60 min ago, ticket not sent). */
export async function resumableCall(deps: VoiceDeps, session: Session): Promise<VoiceCall | null> {
  const last = await findResumable(deps.db, authorIdOf(session), deps.clock.now());
  return last ? getCall(deps, session, last.id) : null;
}

/** Admins see the whole conversation when a call continued a dropped one. */
export async function adminGetCall(deps: VoiceDeps, id: string): Promise<AdminVoiceCall> {
  const call = await repo.findCall(deps.db, id);
  const threadId = threadOf(call);
  const lines = await threadLines(deps.db, threadId);
  return toAdminVoiceCall(call, await threadDraft(deps.db, threadId), lines);
}
