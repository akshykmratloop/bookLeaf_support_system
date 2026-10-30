import { DESCRIPTION_LIMITS, SUBJECT_LIMITS } from '@bookleaf/shared';
import { categoryKeysOf, type WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import type { VoiceTool } from '../providers/types.js';

export const UPDATE_TICKET_DRAFT = 'update_ticket_draft';
export const CONFIRM_TICKET = 'confirm_ticket';
export const SUBMIT_TICKET = 'submit_ticket';
export const END_CALL = 'end_call';

/** Tools that act on the shared ticket draft (run by the server, never in the browser). */
export const DRAFT_TOOLS = new Set([UPDATE_TICKET_DRAFT, CONFIRM_TICKET, SUBMIT_TICKET]);

const nullableString = (description: string) => ({ type: ['string', 'null'], description });

/** Fills in the draft; the issue types are the workspace's own active category keys. */
const updateDraftTool = (k: WorkspaceKnowledge): VoiceTool => ({
  name: UPDATE_TICKET_DRAFT,
  description:
    'Fill in or change the ticket draft the author sees on screen. Pass only the fields to change; the author can also edit them. Nothing is sent.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: ['string', 'null'],
        enum: [...categoryKeysOf(k), null],
        description: 'Issue type id from ISSUE TYPES.',
      },
      book_id: nullableString('The id of the book from BOOKS; leave out for account-level issues.'),
      subject: nullableString(
        `Short subject, ${SUBJECT_LIMITS.min} to ${SUBJECT_LIMITS.max} characters.`,
      ),
      description: nullableString(
        `What the author needs, written as the author, ${DESCRIPTION_LIMITS.min} to ${DESCRIPTION_LIMITS.max} characters, verified figures only.`,
      ),
    },
  },
});

const STATIC_TOOLS: VoiceTool[] = [
  {
    name: CONFIRM_TICKET,
    description:
      'Call this right after reading back the issue type and subject and asking "Shall I send it?". Needs a subject and a description.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: SUBMIT_TICKET,
    description:
      'Send the ticket. Only after confirm_ticket and a clear yes from the author. Returns the ticket number.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: END_CALL,
    description:
      'End the call. Use it when the author says goodbye or the conversation is finished. Say a short goodbye first.',
    parameters: { type: 'object', properties: {} },
  },
];

/** The call's tools, for the author's workspace. */
export const voiceTools = (k: WorkspaceKnowledge): VoiceTool[] => [
  updateDraftTool(k),
  ...STATIC_TOOLS,
];
