import type { Db } from '../../platform/db.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { getCall } from './calls.js';
import { getChat } from './chats.js';
import { listConversations } from './list.js';

/** An author's past chats and calls, read-only. Works even when an admin has switched chat off. */
export function createConversationService(db: Db) {
  return {
    list: (s: Session, q: { cursor?: string; limit: number }) =>
      listConversations(db, authorIdOf(s), q),
    getChat: (s: Session, id: string) => getChat(db, authorIdOf(s), id),
    getCall: (s: Session, id: string) => getCall(db, authorIdOf(s), id),
  };
}
export type ConversationService = ReturnType<typeof createConversationService>;
