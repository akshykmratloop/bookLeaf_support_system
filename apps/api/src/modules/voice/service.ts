import { Prisma } from '@prisma/client';
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
import { createTicket, getAuthorTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import { buildCallContext, type CallContext } from './context.js';
import { finishCall } from './finish.js';
import { toAdminVoiceCall, toVoiceCall } from './mappers.js';
import { checkQuota } from './quota.js';
import {
  CONNECT_WITHIN_SECONDS,
  expireStale,
  findCall,
  findOwnCall,
  lockAuthor,
  markCallFailed,
  replaceUnconnectedCalls,
} from './repository.js';

interface Deps extends TicketDeps {
  assistant: AssistantService;
  limits: AssistantLimits;
  provider: VoiceProvider | null;
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
    async start(session: Session): Promise<StartVoiceCall> {
      await assistant.requireVoiceEnabled();
      const authorId = authorIdOf(session);
      const provider = deps.provider;
      if (!provider) throw new VoiceUnavailableError();
      const now = clock.now();
      await expireStale(db, authorId, now, maxSeconds);
      const call = await db.$transaction(async (tx) => {
        await lockAuthor(tx, authorId);
        await replaceUnconnectedCalls(tx, authorId);
        await checkQuota(tx, limits.voice, authorId, now);
        return tx.voiceSession.create({
          data: {
            authorId,
            provider: provider.id,
            model: provider.model,
            maxSeconds,
            createdAt: now,
          },
        });
      });
      return {
        id: call.id,
        socketPath: `/api/v1/voice/calls/${call.id}/stream`,
        maxSeconds,
        connectWithinSeconds: CONNECT_WITHIN_SECONDS,
      };
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
          createdAt: { gte: new Date(now.getTime() - CONNECT_WITHIN_SECONDS * 1000) },
        },
        data: { status: 'ACTIVE', startedAt: now },
      });
      if (res.count !== 1)
        throw new ConflictError(
          'VOICE_CALL_NOT_CONNECTABLE',
          'This call has expired or is already connected.',
        );
      try {
        return await buildCallContext(db, authorId, clock.dataAsOf(), maxSeconds);
      } catch (err) {
        // The row is already ACTIVE: release it so the author is not blocked until it expires.
        await markCallFailed(db, id, clock.now());
        throw err;
      }
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
      await markCallFailed(db, callId, clock.now());
    },

    async isVoiceStillOn(): Promise<boolean> {
      return (await assistant.settings()).voiceEnabled;
    },

    async get(session: Session, id: string): Promise<VoiceCall> {
      return toVoiceCall(await findOwnCall(db, id, authorIdOf(session)));
    },

    async adminGet(id: string): Promise<AdminVoiceCall> {
      return toAdminVoiceCall(await findCall(db, id));
    },

    /** One ticket per ended call, confirmed and edited by the author. */
    async raiseTicket(
      session: Session,
      id: string,
      input: z.output<typeof ChatTicketRequestSchema>,
      key: string | null,
    ): Promise<{ ticket: AuthorTicket; created: boolean }> {
      const call = await findOwnCall(db, id, authorIdOf(session));
      if (call.status !== 'ENDED')
        throw new ConflictError(
          'VOICE_CALL_NOT_ENDED',
          'You can raise a ticket once the call has ended.',
        );
      if (call.ticket)
        return { ticket: await getAuthorTicket(deps, session, call.ticket.id), created: false };
      try {
        return await createTicket(deps, session, input, key, {
          source: 'VOICE',
          voiceSessionId: call.id,
        });
      } catch (err) {
        const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        const existing = raced
          ? await db.ticket.findUnique({ where: { voiceSessionId: call.id } })
          : null;
        if (!existing) throw err;
        return { ticket: await getAuthorTicket(deps, session, existing.id), created: false };
      }
    },
  };
}

export type VoiceService = ReturnType<typeof createVoiceService>;
