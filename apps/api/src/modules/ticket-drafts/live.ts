import type { DraftEditor, TicketDraft } from '@bookleaf/shared';

export interface DraftChange {
  draft: TicketDraft;
  by: DraftEditor;
  /** Fields that changed, for telling the assistant what the author did. */
  changed: (keyof TicketDraft)[];
}

type Listener = (change: DraftChange) => void;

/**
 * Who is watching which draft right now (a live call). In-process only: correct while the API
 * runs as a single instance, like platform/event-bus.ts.
 */
export function draftLiveUpdates() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    subscribe(draftId: string, fn: Listener): () => void {
      const set = listeners.get(draftId) ?? new Set<Listener>();
      set.add(fn);
      listeners.set(draftId, set);
      return () => {
        set.delete(fn);
        if (set.size === 0) listeners.delete(draftId);
      };
    },
    publish(change: DraftChange): void {
      listeners.get(change.draft.id)?.forEach((fn) => fn(change));
    },
  };
}

export type DraftLiveUpdates = ReturnType<typeof draftLiveUpdates>;
