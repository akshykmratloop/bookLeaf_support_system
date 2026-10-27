import { describe, expect, it } from 'vitest';
import { TIME_WARNING } from './lifecycle.js';
import { personaBlock, spokenLines, transcriptionLanguage } from './persona.js';
import { TURN_LIMIT_GOODBYE } from './turn-limit.js';

describe('voice persona', () => {
  it('speaks warm, respectful Hinglish but keeps every figure in exact English words', () => {
    const block = personaBlock('hinglish');
    expect(block).toMatch(/Hinglish/);
    expect(block).toMatch(/"aap"/);
    expect(block).toMatch(/amounts, dates, ticket numbers, ISBNs/);
    expect(block).toMatch(/ek second, main check karti hoon/);
    expect(block).toMatch(/AI voice assistant/);
    expect(block).toMatch(/never promise refunds, payouts or dates/i);
  });

  it('mirrors the author: English when they speak English', () => {
    expect(personaBlock('hinglish')).toMatch(/mostly English, answer in clear Indian English/);
    const english = personaBlock('english');
    expect(english).not.toMatch(/Hinglish/);
    expect(english).toMatch(/one moment, let me check/);
  });

  it('greets by first name in the chosen style', () => {
    const hi = spokenLines('hinglish');
    expect(hi.greeting.new('Priya')).toMatch(/^Namaste Priya ji/);
    expect(hi.greeting.chat('Priya')).toMatch(/chat/);
    expect(spokenLines('english').greeting.new('Priya')).toBe(
      'Hi Priya, this is BookLeaf support. How can I help with your books today?',
    );
  });

  it('keeps the English warning and limit goodbye unchanged, with Hinglish versions', () => {
    expect(spokenLines('english')).toMatchObject({
      timeWarning: TIME_WARNING,
      turnLimitGoodbye: TURN_LIMIT_GOODBYE,
    });
    const hi = spokenLines('hinglish');
    expect(hi.timeWarning).toMatch(/thirty seconds/);
    expect(hi.turnLimitGoodbye).toMatch(/limit/);
    expect(hi.turnLimitGoodbye).toMatch(/new conversation/);
  });

  it('lets the speech service detect Hindi or English instead of forcing English', () => {
    expect(transcriptionLanguage('hinglish')).toBeNull();
    expect(transcriptionLanguage('english')).toBe('en');
  });
});
