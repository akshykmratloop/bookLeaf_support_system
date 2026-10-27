export type QueuedStatus = 'waiting' | 'sending' | 'failed';

export interface QueuedMessage {
  localId: string;
  text: string;
  status: QueuedStatus;
  error: string | null;
}

/**
 * Messages the author has typed but that are not answered yet. They are sent one at a time,
 * in order, so the author can keep typing while earlier ones are answered. A failure pauses
 * the queue on that message until the author retries or removes it.
 */
export class MessageQueue {
  private items: QueuedMessage[] = [];
  private running = false;
  private seq = 0;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly deliver: (text: string) => Promise<void>,
    private readonly describeError: (err: unknown) => string,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.items;

  add(text: string): void {
    this.seq += 1;
    this.update([...this.items, { localId: `q${this.seq}`, text, status: 'waiting', error: null }]);
    void this.pump();
  }

  retry(localId: string): void {
    this.update(this.items.map((m) => (m.localId === localId ? { ...m, status: 'waiting' } : m)));
    void this.pump();
  }

  remove(localId: string): void {
    this.update(this.items.filter((m) => m.localId !== localId));
    void this.pump();
  }

  private update(next: QueuedMessage[]) {
    this.items = next;
    this.listeners.forEach((fn) => fn());
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let head = this.items[0];
      while (head && head.status === 'waiting') {
        await this.sendOne(head);
        head = this.items[0];
      }
    } finally {
      this.running = false;
    }
  }

  private async sendOne(item: QueuedMessage): Promise<void> {
    const id = item.localId;
    this.update(this.items.map((m) => (m.localId === id ? { ...m, status: 'sending' } : m)));
    try {
      await this.deliver(item.text);
      this.update(this.items.filter((m) => m.localId !== id));
    } catch (err) {
      const error = this.describeError(err);
      this.update(
        this.items.map((m) => (m.localId === id ? { ...m, status: 'failed', error } : m)),
      );
    }
  }
}
