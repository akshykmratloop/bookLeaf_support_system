import { z } from 'zod';
import { TicketProposalSchema } from './chat.js';

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
  maxSeconds: z.int(),
  connectWithinSeconds: z.int(),
});
export type StartVoiceCall = z.infer<typeof StartVoiceCallSchema>;

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
  z.object({ type: z.literal('ticket_suggested') }),
  z.object({ type: z.literal('ended'), reason: z.enum(VOICE_END_REASONS) }),
]);
export type VoiceServerMessage = z.infer<typeof VoiceServerMessageSchema>;

/** JSON control messages the browser may send (audio goes as binary frames). */
export const VoiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hangup') }),
]);
export type VoiceClientMessage = z.infer<typeof VoiceClientMessageSchema>;
