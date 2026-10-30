import { DRAFT_EDITORS, TicketDraftSchema } from '@bookleaf/shared';
import { z } from 'zod';
import { sharedChannel } from '../../platform/shared-state/channel.js';
import type { SharedState, SharedStateLog } from '../../platform/shared-state/types.js';

/** Checked again when the change arrives from another copy of the API. */
const DraftChangeSchema = z.object({
  draft: TicketDraftSchema,
  by: z.enum(DRAFT_EDITORS),
  /** Fields that changed, for telling the assistant what the author did. */
  changed: z.array(TicketDraftSchema.keyof()).max(20),
  /** The author emptied the whole draft (Discard). */
  discarded: z.boolean().optional(),
});
export type DraftChange = z.infer<typeof DraftChangeSchema>;

type Listener = (change: DraftChange) => void;

/**
 * Who is watching which draft right now (a live call). A call lives on the copy that holds its
 * connection, but the author's edits may reach any copy, so changes travel to every copy (F-19).
 */
export function draftLiveUpdates(state: SharedState, log: SharedStateLog) {
  const listeners = new Map<string, Set<Listener>>();
  const channel = sharedChannel(state, 'draft-changes', DraftChangeSchema, log);
  channel.listen((change) => listeners.get(change.draft.id)?.forEach((fn) => fn(change)));
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
      channel.publish(change);
    },
    ready: channel.ready,
    close: channel.close,
  };
}

export type DraftLiveUpdates = ReturnType<typeof draftLiveUpdates>;
