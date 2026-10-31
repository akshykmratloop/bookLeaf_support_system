import { z } from 'zod';
import { TicketProposalSchema } from './chat.js';
import { TicketDraftSchema } from './ticket-drafts.js';

/** Audio on the call socket: PCM16 little-endian, mono, this rate, in both directions. */
export const VOICE_SAMPLE_RATE = 24_000;

export const VOICE_CALL_STATUSES = ['PENDING', 'ACTIVE', 'ENDED', 'FAILED', 'EXPIRED'] as const;
export const VOICE_END_REASONS = [
  'USER_HANGUP',
  'TIME_LIMIT',
  'ASSISTANT_ENDED',
  'IDLE',
  'DISCONNECTED',
  'DISABLED_BY_ADMIN',
  'PROVIDER_ERROR',
  'SERVER_RESTART',
  /** The conversation reached its message limit during the call. */
  'TURN_LIMIT',
] as const;
export type VoiceEndReason = (typeof VOICE_END_REASONS)[number];

export const TranscriptLineSchema = z.object({
  role: z.enum(['AUTHOR', 'ASSISTANT']),
  text: z.string(),
  at: z.iso.datetime(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

/** Returned when a call is created. The browser must open the socket within `connectWithinSeconds`. */
export const StartVoiceCallSchema = z.object({
  id: z.uuid(),
  socketPath: z.string(),
  /**
   * Set when the web app is served from another site than the API: open this absolute URL
   * instead of `socketPath` on the page's own host, with `socketTicket`.
   */
  socketUrl: z.string().optional(),
  /**
   * The 60-second, one-time ticket for `socketUrl`. It travels as a WebSocket subprotocol
   * (`ticket.<ticket>`, beside `bookleaf.v1`), never in the URL, so it is not logged anywhere.
   */
  socketTicket: z.string().optional(),
  maxSeconds: z.int(),
  connectWithinSeconds: z.int(),
});
export type StartVoiceCall = z.infer<typeof StartVoiceCallSchema>;

/** The call socket's subprotocol; the server answers with it. */
export const VOICE_SOCKET_PROTOCOL = 'bookleaf.v1';
/** A one-time stream ticket is offered as the subprotocol `ticket.<ticket>`. */
export const VOICE_TICKET_PROTOCOL_PREFIX = 'ticket.';

/** A dropped call can be continued within this many minutes if its ticket wasn't sent. */
export const RESUME_WITHIN_MINUTES = 60;

/**
 * Starting a call. `chatSessionId` makes the call part of that chat conversation: it hears the
 * chat, shares its ticket draft, and its lines are saved into the chat. Without it, `resume`
 * continues the last dropped call (same conversation and ticket draft).
 */
export const StartVoiceCallRequestSchema = z.object({
  resume: z.boolean().default(false),
  chatSessionId: z.uuid().optional(),
});
export type StartVoiceCallRequest = z.input<typeof StartVoiceCallRequestSchema>;

export const VoiceCallSchema = z.object({
  id: z.uuid(),
  status: z.enum(VOICE_CALL_STATUSES),
  maxSeconds: z.int(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  endReason: z.enum(VOICE_END_REASONS).nullable(),
  durationSeconds: z.int().nullable(),
  transcript: z.array(TranscriptLineSchema),
  proposal: TicketProposalSchema.nullable(),
  ticket: z.object({ id: z.uuid(), number: z.string() }).nullable(),
  /** Calls continued after a drop share one thread (and one ticket draft). */
  threadId: z.uuid(),
  draft: TicketDraftSchema.nullable(),
});
export type VoiceCall = z.infer<typeof VoiceCallSchema>;

/** Admin view adds the check of every figure the assistant spoke. */
export const AdminVoiceCallSchema = VoiceCallSchema.extend({
  spokenCheck: z
    .object({
      passed: z.boolean(),
      issues: z.array(z.object({ code: z.string(), message: z.string() })),
    })
    .nullable(),
});
export type AdminVoiceCall = z.infer<typeof AdminVoiceCallSchema>;

/** JSON control messages the server sends on the call socket (audio goes as binary frames). */
export const VoiceServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), maxSeconds: z.int() }),
  z.object({
    type: z.literal('transcript'),
    role: z.enum(['AUTHOR', 'ASSISTANT']),
    text: z.string(),
  }),
  /** The caller started speaking: stop playing queued assistant audio now. */
  z.object({ type: z.literal('interrupt') }),
  z.object({ type: z.literal('time_warning'), secondsLeft: z.int() }),
  /** The ticket draft changed (by the assistant or on screen); the panel shows this version. */
  z.object({ type: z.literal('draft'), draft: TicketDraftSchema }),
  z.object({ type: z.literal('ended'), reason: z.enum(VOICE_END_REASONS) }),
]);
export type VoiceServerMessage = z.infer<typeof VoiceServerMessageSchema>;

/** JSON control messages the browser may send (audio goes as binary frames). */
export const VoiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hangup') }),
]);
export type VoiceClientMessage = z.infer<typeof VoiceClientMessageSchema>;
