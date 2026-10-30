import type { TicketDraft } from '@bookleaf/shared';
import { z } from 'zod';
import { cleanDraftFields, type DraftChoices } from '../../ai/chat/draft-action.js';
import { AppError } from '../../platform/errors.js';
import { CONFIRM_TICKET, SUBMIT_TICKET, UPDATE_TICKET_DRAFT } from '../../voice/call/tool-defs.js';
import type { DraftPort } from '../../voice/call/types.js';
import type { Session } from '../auth/session.js';
import type { DraftLiveUpdates } from '../ticket-drafts/live.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';

const UpdateArgs = z.object({
  category: z.string().max(40).nullish(),
  book_id: z.string().max(100).nullish(),
  subject: z.string().max(5000).nullish(),
  description: z.string().max(20_000).nullish(),
});

interface PortDeps {
  drafts: TicketDraftService;
  live: DraftLiveUpdates;
}

const summary = (d: TicketDraft) => ({
  status: d.status,
  category: d.category,
  subject: d.subject,
  complete: d.isComplete,
});

function parseArgs(json: string) {
  try {
    return UpdateArgs.safeParse(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * The live call's view of its ticket draft. Tool calls go through the same draft service as the
 * screen, so the same rules apply; rule refusals go back to the model as tool errors.
 */
export function draftPort(
  deps: PortDeps,
  session: Session,
  draft: TicketDraft,
  choices: DraftChoices,
): DraftPort {
  const authorId = session.authorId ?? '';
  const { drafts } = deps;

  async function update(json: string) {
    const args = parseArgs(json);
    if (!args?.success) return { error: 'Invalid arguments for update_ticket_draft.' };
    const patch = cleanDraftFields({ ...args.data, bookId: args.data.book_id }, choices);
    if (Object.keys(patch).length === 0) return { error: 'Nothing to change.' };
    return {
      status: 'updated',
      draft: summary(await drafts.edit(authorId, draft.id, patch, 'ASSISTANT')),
    };
  }

  async function run(name: string, json: string): Promise<Record<string, unknown>> {
    try {
      if (name === UPDATE_TICKET_DRAFT) return await update(json);
      if (name === CONFIRM_TICKET) {
        await drafts.requestConfirmation(authorId, draft.id);
        return { status: 'awaiting_confirmation', next: 'Wait for a clear yes, then submit.' };
      }
      if (name === SUBMIT_TICKET) {
        const sent = await drafts.submit(session, draft.id, { by: 'ASSISTANT', version: null });
        return { status: 'sent', ticket_number: sent.ticket.number };
      }
      return { error: 'Unknown tool' };
    } catch (err) {
      if (err instanceof AppError) return { error: err.message, code: err.code };
      throw err;
    }
  }

  return { initial: draft, run, watch: (fn) => deps.live.subscribe(draft.id, fn) };
}
