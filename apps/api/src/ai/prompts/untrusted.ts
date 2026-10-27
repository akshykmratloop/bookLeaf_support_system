/** Tags the prompts use to fence off text written by the author. */
const FENCE_TAG = /<(\s*\/?\s*)(author_message|author_editable|earlier_conversation)\b([^>]*)>/gi;

/**
 * Makes author text safe to place inside a prompt fence: any of our fence tags inside it is
 * turned into look-alike brackets, so the text cannot close its block and pose as instructions.
 */
export const fenceSafe = (text: string): string =>
  text.replace(
    FENCE_TAG,
    (_m, slash: string, name: string, rest: string) => `‹${slash}${name}${rest}›`,
  );
