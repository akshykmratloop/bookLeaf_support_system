import type { EditTicketDraftSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError } from '../../platform/errors.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { DraftLiveUpdates } from './live.js';

/** What the ticket-draft module needs from the rest of the app. */
export interface DraftDeps extends TicketDeps {
  live: DraftLiveUpdates;
}

export type DraftPatch = z.output<typeof EditTicketDraftSchema>;

export const draftSent = () =>
  new ConflictError('DRAFT_SENT', 'This ticket has already been sent.');

export const draftChanged = () =>
  new ConflictError('DRAFT_CHANGED', 'The draft just changed. Check it and press Send again.');
