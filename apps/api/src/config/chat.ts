import { z } from 'zod';
import { int } from './fields.js';

/** Abuse limits for the author chat and the ticket draft panel. Admins switch chat on or off. */
export const ChatConfig = z.object({
  CHAT_MESSAGES_PER_MINUTE: int(1, 120, 20),
  CHAT_MESSAGES_PER_DAY: int(1, 2000, 100),
  CHAT_MAX_TURNS_PER_SESSION: int(1, 200, 30),
  CHAT_SESSIONS_PER_HOUR: int(1, 100, 10),
  /** The draft panel autosaves after each pause in typing. */
  TICKET_DRAFT_EDITS_PER_MINUTE: int(10, 600, 120),
});
