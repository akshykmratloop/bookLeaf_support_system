import type {
  AdminVoiceCall,
  AuthorTicket,
  ChatTicketRequestSchema,
  Fact,
  StartVoiceCall,
  VoiceCall,
} from '@bookleaf/shared';
import type { z } from 'zod';
import { AppError, ConflictError, ForbiddenError } from '../../platform/errors.js';
import type { CallLimits, CallOutcome } from '../../voice/call/controller.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { AssistantService } from '../assistant/service.js';
import type { Session } from '../auth/session.js';
import type { DraftLiveUpdates } from '../ticket-drafts/live.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import type { TicketDeps } from '../tickets/deps.js';
import { raiseCallTicket } from './call-ticket.js';
import { contextFor, newCallIds, threadDraft } from './call-setup.js';
import type { CallContext } from './context.js';
import { draftPort } from './draft-port.js';
import { finishCall } from './finish.js';
import { toAdminVoiceCall, toVoiceCall } from './mappers.js';
import { checkQuota } from './quota.js';
import * as repo from './repository.js';
import { findResumable, threadLines, threadOf } from './thread.js';

interface Deps extends TicketDeps {
  assistant: AssistantService;
  limits: AssistantLimits;
  provider: VoiceProvider | null;
  drafts: TicketDraftService;
  live: DraftLiveUpdates;
}

class VoiceUnavailableError extends AppError {
  constructor() {
    super(
      503,
      'VOICE_UNAVAILABLE',
      'Voice calls are unavailable right now. You can use chat or raise a ticket.',
    );
  }
}

function authorIdOf(session: Session): string {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('Only authors can make voice calls');
  return session.authorId;
}

export function createVoiceService(deps: Deps) {
  const { db, clock, assistant, limits } = deps;
  const maxSeconds = limits.voice.maxCallSeconds;

  return {
    /** Creates a PENDING call after the switch, provider and per-author limits all pass. */
    async start(session: Session, opts: { resume: boolean }): Promise<StartVoiceCall> {
      await assistant.requireVoiceEnabled();
      const authorId = authorIdOf(session);
      const provider = deps.provider;
      if (!provider) throw new VoiceUnavailableError();
      const now = clock.now();
      await repo.expireStale(db, authorId, now, maxSeconds);
      const call = await db.$transaction(async (tx) => {
        await repo.lockAuthor(tx, authorId);
        await repo.replaceUnconnectedCalls(tx, authorId);
        await checkQuota(tx, limits.voice, authorId, now);
        const ids = await newCallIds(tx, authorId, opts.resume, now);
        const { id: providerId, model } = provider;
        return tx.voiceSession.create({
          data: { ...ids, authorId, provider: providerId, model, maxSeconds, createdAt: now },
        });
      });
      return {
        id: call.id,
        socketPath: `/api/v1/voice/calls/${call.id}/stream`,
        maxSeconds,
        connectWithinSeconds: repo.CONNECT_WITHIN_SECONDS,
      };
    },

    /** The author's last call if it can be continued (ended < 60 min ago, ticket not sent). */
    async resumable(session: Session): Promise<VoiceCall | null> {
      const authorId = authorIdOf(session);
      const last = await findResumable(db, authorId, clock.now());
      if (!last) return null;
      const call = await repo.findOwnCall(db, last.id, authorId);
      return toVoiceCall(call, await threadDraft(db, threadOf(call)));
    },

    /** Socket connected: the call moves PENDING → ACTIVE exactly once, within the connect window. */
    async claim(session: Session, id: string): Promise<CallContext> {
      const authorId = authorIdOf(session);
      const now = clock.now();
      const res = await db.voiceSession.updateMany({
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
        return await contextFor(deps, authorId, id, maxSeconds);
      } catch (err) {
        // The row is already ACTIVE: release it so the author is not blocked until it expires.
        await repo.markCallFailed(db, id, clock.now());
        throw err;
      }
    },

    /** The live call's connection to its ticket draft (same rules as the screen). */
    draftPort(session: Session, ctx: CallContext) {
      return draftPort({ drafts: deps.drafts, live: deps.live }, session, ctx.draft, ctx.books);
    },

    /** Rules the live call enforces; the hard cap comes from env (at most 300 s). */
    callLimits(): CallLimits {
      return {
        maxSeconds,
        warnBeforeEndSeconds: 30,
        idleSeconds: 45,
        recheckSeconds: 15,
        goodbyeSeconds: 8,
      };
    },

    async finish(
      callId: string,
      outcome: CallOutcome,
      ctx: { facts: Fact[]; ignorePhrases: string[] },
    ) {
      const provider = deps.provider;
      await finishCall(db, {
        callId,
        providerId: provider?.id ?? 'unknown',
        model: provider?.model ?? 'unknown',
        outcome,
        ...ctx,
      });
    },

    /** Last resort when saving the outcome failed: at least free the author's call slot. */
    async markFailed(callId: string): Promise<void> {
      await repo.markCallFailed(db, callId, clock.now());
    },

    async isVoiceStillOn(): Promise<boolean> {
      return (await assistant.settings()).voiceEnabled;
    },

    async get(session: Session, id: string): Promise<VoiceCall> {
      const call = await repo.findOwnCall(db, id, authorIdOf(session));
      return toVoiceCall(call, await threadDraft(db, threadOf(call)));
    },

    /** Admins see the whole conversation when a call continued a dropped one. */
    async adminGet(id: string): Promise<AdminVoiceCall> {
      const call = await repo.findCall(db, id);
      const threadId = threadOf(call);
      const lines = await threadLines(db, threadId);
      return toAdminVoiceCall(call, await threadDraft(db, threadId), lines);
    },

    /** One ticket per ended call, confirmed and edited by the author (older after-call form). */
    async raiseTicket(
      session: Session,
      id: string,
      input: z.output<typeof ChatTicketRequestSchema>,
      key: string | null,
    ): Promise<{ ticket: AuthorTicket; created: boolean }> {
      const call = await repo.findOwnCall(db, id, authorIdOf(session));
      return raiseCallTicket(deps, session, call, input, key);
    },
  };
}

export type VoiceService = ReturnType<typeof createVoiceService>;
