import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../test/fixtures/host.js';
import { factsFor } from '../../host/facts.js';
import { checkSpokenFigures } from '../../modules/voice/finish.js';
import { wordsToDigits } from './number-words.js';

describe('wordsToDigits', () => {
  it.each([
    ['three thousand five hundred and seventy rupees', '3570 rupees'],
    ['one thousand rupees', '1000 rupees'],
    ['forty-eight hours', '48 hours'],
    ['five to seven business days', '5 to 7 business days'],
    ['two lakh fifty thousand rupees', '250000 rupees'],
    ['teen hazaar rupees nahi, three hazaar rupees', 'teen hazaar rupees nahi, 3000 rupees'],
    ['one crore', '10000000'],
    ['twelve copies', '12 copies'],
  ])('%s → %s', (spoken, digits) => {
    expect(wordsToDigits(spoken)).toBe(digits);
  });

  it('leaves ordinary words and digits alone', () => {
    expect(wordsToDigits('Namaste Priya ji, ₹3,570 is pending')).toBe(
      'Namaste Priya ji, ₹3,570 is pending',
    );
    expect(wordsToDigits('someone, anyone, often')).toBe('someone, anyone, often');
  });
});

describe('spoken-figure check on amounts said in words (audit F-07)', () => {
  const facts = factsFor(sampleCustomer('AUTH001'), 'BK001');
  const said = (text: string) =>
    checkSpokenFigures(
      {
        reason: 'CALLER_HUNG_UP',
        transcript: [{ role: 'ASSISTANT', text, at: new Date(0).toISOString() }],
        durationSeconds: 30,
        inputTokens: 0,
        outputTokens: 0,
      } as never,
      facts,
      [],
    );

  it('passes the real pending amount spoken in words', () => {
    expect(said('You have three thousand five hundred and seventy rupees pending.').passed).toBe(
      true,
    );
  });

  it('flags an invented amount spoken in words', () => {
    const r = said('You have three thousand five hundred rupees pending.');
    expect(r.passed).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('UNSUPPORTED_AMOUNT');
  });
});
