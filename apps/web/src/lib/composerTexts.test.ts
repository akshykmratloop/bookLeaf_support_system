import { describe, expect, it } from 'vitest';
import { cleared, EMPTY_TEXTS, textFor, withText } from './composerTexts';

describe('reply and internal note keep separate text (U-3)', () => {
  it('switching to the note shows an empty box, switching back restores the reply exactly', () => {
    const typed = withText(EMPTY_TEXTS, 'REPLY', 'Hi Priya,\n\nYour payout is on its way.');
    expect(textFor(typed, 'INTERNAL_NOTE')).toBe('');
    expect(textFor(typed, 'REPLY')).toBe('Hi Priya,\n\nYour payout is on its way.');
  });

  it("the note keeps its own text and never changes the reply's", () => {
    const reply = withText(EMPTY_TEXTS, 'REPLY', 'Reply text');
    const both = withText(reply, 'INTERNAL_NOTE', 'Checked the ledger.');
    expect(both).toEqual({ reply: 'Reply text', note: 'Checked the ledger.' });
  });

  it('sending clears only the box that was sent', () => {
    const both = { reply: 'Reply text', note: 'Note text' };
    expect(cleared(both, 'INTERNAL_NOTE')).toEqual({ reply: 'Reply text', note: '' });
    expect(cleared(both, 'REPLY')).toEqual({ reply: '', note: 'Note text' });
  });
});
