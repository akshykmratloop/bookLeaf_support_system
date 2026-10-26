import { describe, expect, it } from 'vitest';
import { AiUnavailableError } from '../providers/errors.js';
import { fakeProvider } from '../providers/fake/provider.js';
import { classifyByKeywords } from './fallback-classifier.js';
import { priorityFloor } from './rules.js';
import { fallbackTriage, runAiTriage, type TriageInput } from './service.js';

const input = (description: string, extra: Partial<TriageInput> = {}): TriageInput => ({
  subject: 'Help',
  description,
  bookTitle: 'The Silent Garden',
  bookStage: 'Published & Live',
  royaltyStatus: null,
  ...extra,
});

describe('priority floor', () => {
  it('raises ISBN errors, overdue royalties, long-unpaid and legal threats to at least HIGH', () => {
    expect(priorityFloor({ text: 'Amazon shows a different ISBN than my copy', category: 'ISBN_METADATA', royaltyStatus: null }).floor).toBe('HIGH');
    expect(priorityFloor({ text: 'Where is my money', category: 'ROYALTY_PAYMENTS', royaltyStatus: 'POSSIBLY_OVERDUE' }).floor).toBe('HIGH');
    expect(priorityFloor({ text: "I haven't received any royalty for 6 months", category: 'ROYALTY_PAYMENTS', royaltyStatus: null }).floor).toBe('HIGH');
    expect(priorityFloor({ text: 'I will contact my lawyer', category: 'GENERAL_INQUIRY', royaltyStatus: null }).floor).toBe('HIGH');
  });

  it('leaves ordinary questions at LOW', () => {
    expect(priorityFloor({ text: 'Can I update my author bio?', category: 'GENERAL_INQUIRY', royaltyStatus: null })).toEqual({ floor: 'LOW', reasons: [] });
  });
});

describe('keyword fallback', () => {
  it.each([
    ['The print quality is terrible, images are blurry', 'PRINTING_QUALITY'],
    ['My book shows currently unavailable on Amazon', 'DISTRIBUTION_AVAILABILITY'],
    ['Still in typesetting after 3 weeks, when will it be done', 'BOOK_STATUS_PRODUCTION'],
    ['My royalty payout has not arrived', 'ROYALTY_PAYMENTS'],
    ['Wrong ISBN on my listing', 'ISBN_METADATA'],
    ['Can I update my author bio?', 'GENERAL_INQUIRY'],
  ])('%s → %s', (text, category) => {
    expect(classifyByKeywords(text).category).toBe(category);
  });

  it('marks fallback results for review with source RULES', () => {
    const d = fallbackTriage(input('Wrong ISBN on Amazon'));
    expect(d).toMatchObject({ category: 'ISBN_METADATA', priority: 'HIGH', source: 'RULES', needsReview: true });
  });
});

describe('AI triage', () => {
  it('applies the rules floor on top of the model and flags the change for review', async () => {
    const provider = fakeProvider(() => ({
      category: 'ROYALTY_PAYMENTS',
      priority: 'LOW',
      priorityReasons: ['question about payout'],
      needsInfo: [],
      confidence: 'high',
    }));
    const r = await runAiTriage(provider, 'm', input('Where is my royalty?', { royaltyStatus: 'POSSIBLY_OVERDUE' }));
    expect(r.decision).toMatchObject({ category: 'ROYALTY_PAYMENTS', priority: 'HIGH', source: 'AI', needsReview: true });
    expect(r.decision.priorityReasons[0]).toMatch(/no payout/);
    expect(provider.calls[0]?.user).not.toMatch(/@|₹/);
  });

  it('propagates provider errors so the worker can retry or fall back', async () => {
    const provider = fakeProvider(() => {
      throw new AiUnavailableError('down');
    });
    await expect(runAiTriage(provider, 'm', input('x'))).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
