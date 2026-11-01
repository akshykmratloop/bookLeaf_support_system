import type { ChatTicketRequestSchema, Fact } from '@bookleaf/shared';
import type { z } from 'zod';
import type { CallOutcome } from '../../voice/call/controller.js';
import type { Session } from '../auth/session.js';
import { raiseCallTicket } from './call-ticket.js';
import { callLimits, claimCall, saveCallOutcome } from './claim-call.js';
import type { CallContext } from './context.js';
import type { VoiceDeps } from './deps.js';
import { draftPort } from './draft-port.js';
import { adminGetCall, getCall, resumableCall } from './read-calls.js';
import * as repo from './repository.js';
import { startCall, type StartOptions } from './start-call.js';

type TicketInput = z.output<typeof ChatTicketRequestSchema>;

/** Voice calls: start, connect, finish, read back, and the older after-call ticket form. */
export function createVoiceService(deps: VoiceDeps) {
  return {
    start: (s: Session, opts: StartOptions) => startCall(deps, s, opts),
    resumable: (s: Session) => resumableCall(deps, s),
    claim: (s: Session, id: string) => claimCall(deps, s, id),
    /** The live call's connection to its ticket draft (same rules as the screen). */
    draftPort: (s: Session, ctx: CallContext) =>
      draftPort({ drafts: deps.drafts, live: deps.live }, s, ctx.draft, {
        books: ctx.books,
        knowledge: ctx.knowledge,
      }),
    /** The live call's rules, from its workspace's limits. */
    callLimits: (ctx: CallContext) => callLimits(ctx.limits),
    finish: (
      callId: string,
      outcome: CallOutcome,
      ctx: {
        facts: Fact[];
        ignorePhrases: string[];
        maxTurns: number;
        provider: { id: string; model: string };
        costMicros: number | null;
      },
    ) => saveCallOutcome(deps, { callId, outcome, ...ctx }),
    /** Last resort when saving the outcome failed: at least free the author's call slot. */
    markFailed: (callId: string) => repo.markCallFailed(deps.db, callId, deps.clock.now()),
    isVoiceStillOn: async (s: Session) => (await deps.assistant.config(s.workspaceId)).voiceEnabled,
    get: (s: Session, id: string) => getCall(deps, s, id),
    adminGet: (s: Session, id: string) => adminGetCall(deps, s, id),
    raiseTicket: (s: Session, id: string, ticket: TicketInput, key: string | null) =>
      raiseCallTicket(deps, s, { callId: id, ticket, idempotencyKey: key }),
  };
}

export type VoiceService = ReturnType<typeof createVoiceService>;
