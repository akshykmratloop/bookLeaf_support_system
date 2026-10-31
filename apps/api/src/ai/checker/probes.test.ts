import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../test/fixtures/host.js';
import { factsFor } from '../../host/facts.js';
import { checkReply } from './check.js';
import { findMoney, stripExclusions } from './extract.js';

/** Facts: ₹3,570 pending, payout deadline 14 Feb 2026, 45-day payout window. */
const facts = factsFor(sampleCustomer('AUTH001'), 'BK001');
const HEAD = 'Hi Priya, thank you for writing to us about your royalty.';
const check = (sentence: string, ignorePhrases: string[] = []) =>
  checkReply({ body: `${HEAD} ${sentence}`, facts, ignorePhrases });
const blocks = (sentence: string) => check(sentence).issues.filter((i) => i.severity === 'BLOCK');

describe('figures the checker used to miss (H-AI checker gaps)', () => {
  it.each([
    ['number words', 'You will receive ten thousand rupees next week.'],
    ['a bare comma-grouped number', 'Your balance is 9,999 at the moment.'],
    ['a bare number next to a money word', 'Your royalty of 9999 is ready.'],
    ['a bare number after "pending"', 'The amount pending is 4200.'],
    ['day and month without a year', 'It will be paid by 20 Feb.'],
    ['an ordinal day of a month', 'It will be paid on the 20th of February.'],
    ['month then day', 'It will be paid by February 20.'],
    ['a timeline in weeks', 'It will be paid within 2 weeks.'],
    ['a timeline in months', 'It can take 3 months to arrive.'],
    ['a timeline in quarters', 'It rolls over for 1 quarter.'],
    ['a dollar amount', 'Amazon US paid $500 for your sales.'],
    ['a USD amount', 'Amazon US paid USD 500 for your sales.'],
    ['a euro amount', 'The store paid EUR 20 for your sales.'],
    ['rupees with lakh', 'Your sales are worth ₹5 lakh so far.'],
    ['a bare lakh amount', 'Your sales are worth 50 lakh so far.'],
    ['a crore amount', 'Your sales are worth 2 crore so far.'],
    ['a k amount', 'Your sales are worth 5k so far.'],
    ['malformed grouping', 'Your minimum payout is ₹1,0000.'],
  ])('blocks %s', (_name, sentence) => {
    expect(blocks(sentence).length, sentence).toBeGreaterThan(0);
  });

  it('reads multipliers as their full value, never the bare digits', () => {
    expect(findMoney('₹5 lakh, ₹5k, 2 crore').map((m) => m.value)).toEqual([
      50_000_000, 500_000, 2_000_000_000,
    ]);
    expect(findMoney('₹1,0000').map((m) => m.value)).not.toContain(100_000);
  });

  it.each([
    ['supported number words', 'Three thousand five hundred and seventy rupees is pending.'],
    ['a supported bare amount', 'Your pending royalty is 3,570.'],
    ['a supported day and month', 'It will be paid by 14 Feb.'],
    ['a year alone', 'We will look at your 2026 statement.'],
    ['an hours range', 'We will reply within 24-48 hours.'],
    ['a business-day range', 'Print takes 5-7 business days.'],
    ['a percentage', 'You keep 80% of the royalty.'],
    ['a count of books', 'Your royalty covers 3 books in total.'],
    ['a supported timeline', 'Payouts land within 45 days.'],
  ])('passes %s', (_name, sentence) => {
    expect(blocks(sentence), sentence).toEqual([]);
  });
});

describe('book-title exemptions', () => {
  it('match case-insensitively on word boundaries', () => {
    expect(stripExclusions('About 2025 diaries.', ['2025 Diaries'])).not.toMatch(/\d/);
    expect(stripExclusions('About X2025 Diariesy.', ['2025 Diaries'])).toMatch(/2025/);
  });

  it('escape regex characters in a title', () => {
    expect(stripExclusions('Read (1+1)=2 now.', ['(1+1)=2'])).not.toMatch(/\d/);
  });

  it('never exempt a title that is itself a figure', () => {
    const r = check('Your royalty is ₹50,000.', ['₹50,000']);
    expect(r.issues.map((i) => i.code)).toContain('UNSUPPORTED_AMOUNT');
  });

  it('exempt a title with digits written in another case', () => {
    const sentence = 'The royalty of chapter 9999 is ready.';
    expect(blocks(sentence).length).toBeGreaterThan(0);
    expect(check(sentence, ['Chapter 9999']).passed).toBe(true);
    expect(check('Your book 2025 diaries is live.', ['2025 Diaries']).passed).toBe(true);
  });
});
