import { z } from 'zod';
import { cleanText } from '../sanitize.js';
import { TicketDraftSchema } from './ticket-drafts.js';
import { DESCRIPTION_LIMITS, SUBJECT_LIMITS } from './tickets.js';

export const CHAT_MESSAGE_LIMITS = { min: 1, max: 1000 } as const;

export const CHAT_ROLES = ['AUTHOR', 'ASSISTANT'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

/** AI = checked model answer; SAFE_FALLBACK = the answer failed the fact check; UNAVAILABLE = AI down. */
/** How a message entered the conversation: typed, or spoken on a call started from the chat. */
export const CHAT_CHANNELS = ['CHAT', 'VOICE'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export const CHAT_ANSWER_SOURCES = ['AI', 'RECORDS', 'SAFE_FALLBACK', 'UNAVAILABLE'] as const;
export type ChatAnswerSource = (typeof CHAT_ANSWER_SOURCES)[number];

export const SendChatMessageSchema = z.object({
  body: cleanText(CHAT_MESSAGE_LIMITS.min, CHAT_MESSAGE_LIMITS.max),
});
export type SendChatMessage = z.input<typeof SendChatMessageSchema>;

/** A ticket the assistant suggests. The author reviews and edits it before anything is created. */
export const TicketProposalSchema = z.object({
  subject: z.string(),
  description: z.string(),
  bookId: z.uuid().nullable(),
});
export type TicketProposal = z.infer<typeof TicketProposalSchema>;

/** A verified figure the answer used, shown under the answer so the author can see the source. */
export const ChatFactRefSchema = z.object({ label: z.string(), display: z.string() });

export const ChatMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(CHAT_ROLES),
  body: z.string(),
  source: z.enum(CHAT_ANSWER_SOURCES).nullable(),
  factsUsed: z.array(ChatFactRefSchema),
  proposal: TicketProposalSchema.nullable(),
  channel: z.enum(CHAT_CHANNELS),
  /** The call a VOICE message was spoken on. */
  callId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.uuid(),
  turnCount: z.int(),
  maxTurns: z.int(),
  ticket: z.object({ id: z.uuid(), number: z.string() }).nullable(),
  messages: z.array(ChatMessageSchema),
  /** The conversation's ticket draft (null until the author or the assistant starts one). */
  draft: TicketDraftSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const ChatReplySchema = z.object({
  session: ChatSessionSchema,
  reply: ChatMessageSchema,
});
export type ChatReply = z.infer<typeof ChatReplySchema>;

export const ChatTicketRequestSchema = z.object({
  bookId: z.uuid().nullable(),
  subject: cleanText(SUBJECT_LIMITS.min, SUBJECT_LIMITS.max),
  description: cleanText(DESCRIPTION_LIMITS.min, DESCRIPTION_LIMITS.max),
});
export type ChatTicketRequest = z.input<typeof ChatTicketRequestSchema>;

/** Admin read of a transcript linked to a ticket. */
export const ChatTranscriptSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  messages: z.array(ChatMessageSchema),
});
export type ChatTranscript = z.infer<typeof ChatTranscriptSchema>;
