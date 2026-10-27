import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../../test/fixtures/host.js';
import { allFacts } from '../../../host/facts.js';
import { quickAnswer } from './answers.js';
import { detectQuickIntent } from './intents.js';

function ctxFor(authorId: string, _message: string) {
  const customer = sampleCustomer(authorId);
  return {
    firstName: customer.name.split(' ')[0] ?? customer.name,
    facts: allFacts(customer),
    ignorePhrases: customer.items.map((i) => i.title),
  };
}

describe('detectQuickIntent', () => {
  it.each([
    ['hello', 'GREETING'],
    ['Hi there!', 'GREETING'],
    ['thank you so much', 'THANKS'],
    ['When is the next payout?', 'NEXT_PAYOUT'],
    ['when will I get paid', 'NEXT_PAYOUT'],
    ['How much royalty is pending on my books?', 'PENDING_ROYALTY'],
    ['what amount is due to me', 'PENDING_ROYALTY'],
    ['What stage is my book in?', 'BOOK_STAGE'],
    ['status of my books', 'BOOK_STAGE'],
  ])('%s → %s', (message, intent) => {
    expect(detectQuickIntent(message)).toBe(intent);
  });

  it.each([
    'okay then tell me why i dont get any payout yet',
    "I haven't received my payout",
    'my royalty amount looks wrong',
    'the pending amount is missing for Whispers of the Ganges',
    'book status not updated',
    'what time is it',
    'Can you help me with my payout',
    'x'.repeat(130),
  ])('sends "%s" to the AI', (message) => {
    expect(detectQuickIntent(message)).toBeNull();
  });
});

describe('quickAnswer', () => {
  it('answers pending royalty with the real total and each book, passing the checker', () => {
    const message = 'How much royalty is pending on my books?';
    const ctx = ctxFor('AUTH001', message);
    const a = quickAnswer(message, ctx);
    const total = ctx.facts.find((f) => f.id === 'author.total_pending');
    expect(a?.intent).toBe('PENDING_ROYALTY');
    expect(a?.body).toContain(total?.display ?? 'missing');
    expect(a?.factIds).toContain('author.total_pending');
    expect(a?.check.passed).toBe(true);
  });

  it('answers the next payout with the cycle date and eligibility', () => {
    const message = 'When is the next payout?';
    const ctx = ctxFor('AUTH001', message);
    const deadline = ctx.facts.find((f) => f.id === 'payout.next_cycle_deadline');
    const a = quickAnswer(message, ctx);
    expect(a?.body).toContain(deadline?.display ?? 'missing');
    expect(a?.body).toMatch(/minimum/);
    expect(a?.factIds).toEqual(
      expect.arrayContaining(['payout.next_cycle_deadline', 'author.payout_eligibility']),
    );
  });

  it('lists the stage of every book', () => {
    const message = 'What stage is my book in?';
    const ctx = ctxFor('AUTH001', message);
    const a = quickAnswer(message, ctx);
    for (const s of ctx.facts.filter((f) => f.id.endsWith('.stage'))) {
      expect(a?.body).toContain(s.display);
    }
  });

  it('greets by first name without using any facts', () => {
    const a = quickAnswer('hello', ctxFor('AUTH001', 'hello'));
    expect(a?.body).toMatch(/^Hi Priya!/);
    expect(a?.factIds).toEqual([]);
  });

  it('returns null for anything the AI should handle', () => {
    const message = 'why is my payout late';
    expect(quickAnswer(message, ctxFor('AUTH001', message))).toBeNull();
  });
});
