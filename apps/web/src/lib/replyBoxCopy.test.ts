import { describe, expect, it } from 'vitest';
import { replyBoxCopy } from './replyBoxCopy';

describe('replyBoxCopy (author ticket reply box)', () => {
  it('names the company team so the box is not mistaken for the AI chat', () => {
    const copy = replyBoxCopy('BookLeaf');
    expect(copy.label).toBe('Reply to the BookLeaf team');
    expect(copy.note).toBe(
      'A person from the team reads and answers this ticket. This is not the live chat.',
    );
    expect(copy.placeholder).toBe('Write your reply to the team…');
    expect(copy.sent).toBe('Reply sent to the BookLeaf team');
  });

  it('falls back to "support team" while the company name is unknown or blank', () => {
    expect(replyBoxCopy(undefined).label).toBe('Reply to the support team');
    expect(replyBoxCopy('   ').sent).toBe('Reply sent to the support team');
  });

  it('trims the company name', () => {
    expect(replyBoxCopy('  Acme Books ').label).toBe('Reply to the Acme Books team');
  });
});
