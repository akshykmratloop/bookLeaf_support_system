import type { ConversationPage } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { listCalls } from './calls.js';
import { listChats } from './chats.js';
import { decodeCursor, encodeCursor, newestFirst } from './cursor.js';

/**
 * Chats and calls merged into one newest-first list. Each table is read up to one row past the
 * page, so the merged page is exact and the last row shown becomes the cursor.
 */
export async function listConversations(
  db: Db,
  authorId: string,
  query: { cursor?: string; limit: number },
): Promise<ConversationPage> {
  const from = query.cursor ? decodeCursor(query.cursor) : null;
  const take = query.limit + 1;
  const [chats, calls] = await Promise.all([
    listChats(db, authorId, from, take),
    listCalls(db, authorId, from, take),
  ]);
  const rows = [...chats, ...calls].sort(newestFirst);
  const shown = rows.slice(0, query.limit);
  const last = shown.at(-1);
  return {
    items: shown.map((r) => r.summary),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}
