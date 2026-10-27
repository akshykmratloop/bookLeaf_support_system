import { ConflictError } from '../../platform/errors.js';

/**
 * The conversation used its allowance of author turns (typed messages plus spoken questions on
 * calls started from it). The conversation pauses; a new one can be started.
 */
export const turnLimitError = (maxTurns: number) =>
  new ConflictError(
    'CHAT_TURN_LIMIT',
    `This conversation reached its ${maxTurns}-message limit. Start a new conversation.`,
  );
