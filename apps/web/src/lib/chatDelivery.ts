import type { ChatReply, ChatSession } from '@bookleaf/shared';

export interface ChatCache {
  get: () => ChatSession | null | undefined;
  set: (session: ChatSession) => void;
}

export interface ChatApi {
  start: () => Promise<ChatSession>;
  send: (sessionId: string, text: string) => Promise<ChatReply>;
}

/**
 * Sends the author's messages into the current conversation. "New conversation" starts a new
 * round: an answer still on its way for the old conversation is then dropped instead of
 * bringing the old conversation back, and messages typed meanwhile go to the new one.
 */
export class ChatDelivery {
  private round = 0;
  private starting: Promise<unknown> | null = null;

  constructor(
    private readonly cache: ChatCache,
    private readonly chat: ChatApi,
  ) {}

  deliver = async (text: string): Promise<void> => {
    if (this.starting) await this.starting.catch(() => undefined);
    const round = this.round;
    const existing = this.cache.get();
    const session = existing ?? (await this.chat.start());
    if (round !== this.round) return;
    if (!existing) this.cache.set(session);
    const reply = await this.chat.send(session.id, text);
    if (round === this.round) this.cache.set(reply.session);
  };

  /** Starts a new conversation; the newest press wins if several overlap. */
  async restart(): Promise<ChatSession> {
    this.round += 1;
    const round = this.round;
    const started = this.chat.start();
    this.starting = started;
    try {
      const session = await started;
      if (round === this.round) this.cache.set(session);
      return session;
    } finally {
      if (this.starting === started) this.starting = null;
    }
  }
}
