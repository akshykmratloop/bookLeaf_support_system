import { describe, expect, it } from 'vitest';
import { DRAFT_PROMPT_VERSION, DRAFT_SYSTEM } from './draft.v1.js';

/** Found by the live draft eval (docs/qa/ai-benchmark.md): 20 of 24 drafts needed a manual edit. */
describe('draft prompt rules', () => {
  it('does not prime a placeholder for something the author can check themselves', () => {
    expect(DRAFT_SYSTEM).not.toMatch(/\[CONFIRM: is the author's bank account linked\?\]/);
    expect(DRAFT_SYSTEM).toMatch(/author can check[\s\S]*?themselves/i);
  });

  it('declines an author-stated figure without repeating the number', () => {
    expect(DRAFT_SYSTEM).toMatch(/without repeating the number/i);
  });

  it('records the prompt change in the version stored with each draft', () => {
    expect(DRAFT_PROMPT_VERSION).toBe('draft.v1.1');
  });
});
