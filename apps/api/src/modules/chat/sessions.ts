import type { ChatSession, ChatTranscript } from '@bookleaf/shared';
import { authorIdOf, type Session } from '../auth/session.js';
import { type ChatDeps } from './deps.js';
import { toChatMessage, toChatSession } from './mappers.js';
import { findOwnSession, findSessionById } from './repository.js';

/** One of the author's own conversations, with its limit applied. */
export async function loadChat(deps: ChatDeps, session: Session, id: string) {
  const [s, cfg] = await Promise.all([
    findOwnSession(deps.db, id, authorIdOf(session)),
    deps.assistant.config(session.workspaceId),
  ]);
  return toChatSession(s, cfg.limits.chat.maxTurnsPerSession);
}

/** The author's latest conversation, or null. */
export async function currentChat(deps: ChatDeps, session: Session): Promise<ChatSession | null> {
  await deps.assistant.requireChatEnabled(session.workspaceId);
  const latest = await deps.db.chatSession.findFirst({
    where: { authorId: authorIdOf(session) },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return latest ? loadChat(deps, session, latest.id) : null;
}

export async function startChat(deps: ChatDeps, session: Session): Promise<ChatSession> {
  await deps.assistant.requireChatEnabled(session.workspaceId);
  const authorId = authorIdOf(session);
  const created = await deps.db.chatSession.create({
    data: { workspaceId: session.workspaceId, authorId, createdAt: deps.clock.now() },
  });
  return loadChat(deps, session, created.id);
}

export async function getChat(deps: ChatDeps, session: Session, id: string): Promise<ChatSession> {
  await deps.assistant.requireChatEnabled(session.workspaceId);
  return loadChat(deps, session, id);
}

/** Admin read of any transcript (linked from a chat ticket); works even if chat is off. */
export async function chatTranscript(deps: ChatDeps, id: string): Promise<ChatTranscript> {
  const s = await findSessionById(deps.db, id);
  return {
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    messages: s.messages.map(toChatMessage),
  };
}
