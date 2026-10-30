import type { EditTicketDraft, TicketDraft } from '@bookleaf/shared';

export type DraftField = 'category' | 'bookId' | 'subject' | 'description';
const FIELDS: DraftField[] = ['category', 'bookId', 'subject', 'description'];

export interface DraftValues {
  /** A workspace category key ('' = not chosen). */
  category: string;
  bookId: string;
  subject: string;
  description: string;
}

export interface EditorView {
  /** The latest version from the server. */
  draft: TicketDraft | null;
  /** What the form shows: the server version plus the author's unsaved typing. */
  values: DraftValues;
  saving: boolean;
  sending: boolean;
  discarding: boolean;
  error: string | null;
  /** Fields the assistant just changed, highlighted for a moment. */
  highlighted: DraftField[];
}

export interface DraftApi {
  edit(id: string, patch: EditTicketDraft): Promise<TicketDraft>;
  submit(id: string, version: number): Promise<{ draft: TicketDraft }>;
  discard(id: string, version: number): Promise<TicketDraft>;
}

const EMPTY: DraftValues = { category: '', bookId: '', subject: '', description: '' };
const valuesOf = (d: TicketDraft): DraftValues => ({
  category: d.category ?? '',
  bookId: d.bookId ?? '',
  subject: d.subject,
  description: d.description,
});
const HIGHLIGHT_MS = 2500;

/**
 * Keeps the draft form in step with the server. Text is saved after a pause in typing, choices
 * at once. A field the author is still typing in is never overwritten by an incoming version.
 */
export class DraftEditor {
  private view: EditorView = {
    draft: null,
    values: EMPTY,
    saving: false,
    sending: false,
    discarding: false,
    error: null,
    highlighted: [],
  };
  private readonly listeners = new Set<() => void>();
  private readonly dirty = new Set<DraftField>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: DraftApi,
    private readonly describeError: (err: unknown) => string,
    private readonly debounceMs = 600,
  ) {}

  private onSaved: (draft: TicketDraft) => void = () => undefined;

  /** Told about every version the author's own saves and sends return. */
  setOnSaved(fn: (draft: TicketDraft) => void): void {
    this.onSaved = fn;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.view;

  private set(patch: Partial<EditorView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** A version from the server (a chat reply, a call message or a save response). */
  receive(draft: TicketDraft | null): void {
    const prev = this.view.draft;
    if (!draft) return this.set({ draft: null, values: EMPTY, highlighted: [] });
    if (prev?.id === draft.id && draft.version < prev.version) return;
    if (prev?.id !== draft.id) {
      this.dirty.clear();
      return this.set({ draft, values: valuesOf(draft), highlighted: [], error: null });
    }
    const incoming = valuesOf(draft);
    const values = { ...this.view.values };
    const changed = FIELDS.filter((f) => !this.dirty.has(f) && values[f] !== incoming[f]);
    for (const f of changed) Object.assign(values, { [f]: incoming[f] });
    const highlighted = draft.lastEditedBy === 'ASSISTANT' ? changed : [];
    this.set({ draft, values, highlighted });
    if (highlighted.length) this.clearHighlightLater();
  }

  change<F extends DraftField>(field: F, value: DraftValues[F]): void {
    this.dirty.add(field);
    this.set({ values: { ...this.view.values, [field]: value }, error: null });
    if (this.timer) clearTimeout(this.timer);
    const wait = field === 'category' || field === 'bookId' ? 0 : this.debounceMs;
    this.timer = setTimeout(() => void this.flush(), wait);
  }

  /** Saves pending typing now; saves run one at a time, in order. */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.chain = this.chain.then(() => this.save());
    return this.chain;
  }

  async send(): Promise<void> {
    await this.flush();
    const draft = this.view.draft;
    if (!draft || this.dirty.size > 0) return;
    this.set({ sending: true, error: null });
    try {
      const res = await this.api.submit(draft.id, draft.version);
      this.receive(res.draft);
      this.onSaved(res.draft);
    } catch (err) {
      this.set({ error: this.describeError(err) });
    } finally {
      this.set({ sending: false });
    }
  }

  /** Throws the draft away: unsaved typing is dropped, never saved, and the server empties it. */
  async discard(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.dirty.clear();
    await this.chain; // a save already on its way lands first, so the version below is current
    const draft = this.view.draft;
    if (!draft) return;
    this.set({ discarding: true, error: null });
    try {
      const emptied = await this.api.discard(draft.id, draft.version);
      this.receive(emptied);
      this.onSaved(emptied);
    } catch (err) {
      this.set({ error: this.describeError(err) });
    } finally {
      this.set({ discarding: false });
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
  }

  private async save(): Promise<void> {
    const draft = this.view.draft;
    if (!draft || this.dirty.size === 0) return;
    const sent = { ...this.view.values };
    const fields = [...this.dirty];
    const patch = Object.fromEntries(
      fields.map((f) => [f, (f === 'category' || f === 'bookId') && !sent[f] ? null : sent[f]]),
    ) as EditTicketDraft;
    this.set({ saving: true });
    try {
      const saved = await this.api.edit(draft.id, patch);
      // Typing that continued during the save stays dirty and is saved next.
      for (const f of fields) if (this.view.values[f] === sent[f]) this.dirty.delete(f);
      this.receive(saved);
      this.onSaved(saved);
    } catch (err) {
      this.set({ error: this.describeError(err) });
    } finally {
      this.set({ saving: false });
    }
  }

  private clearHighlightLater() {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.set({ highlighted: [] }), HIGHLIGHT_MS);
  }
}
