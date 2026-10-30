import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../test/fixtures/host.js';
import { factsFor } from '../../host/facts.js';
import { royaltySignals } from '../domain/signals.js';
import { bookleafKnowledge } from '../../modules/categories/bookleaf-knowledge.js';
import { fakeProvider } from '../providers/fake/provider.js';
import { runAiDraft, templateDraft } from './service.js';
import type { DraftInput } from './types.js';

function draftInput(
  authorId: string,
  bookId: string | null,
  category: string,
  text = 'Please help',
): DraftInput {
  const customer = sampleCustomer(authorId);
  const facts = factsFor(customer, bookId);
  const book = customer.items.find((i) => i.id === bookId) ?? null;
  return {
    category,
    knowledge: bookleafKnowledge(),
    authorName: customer.name,
    book: book ? { externalId: book.id, title: book.title } : null,
    facts,
    royalty: royaltySignals(facts, bookId),
    subject: 'Question',
    authorMessages: [text],
    lastTeamReply: null,
    ignorePhrases: customer.items.map((i) => i.title),
  };
}

const figureIssues = (codes: string[]) =>
  codes.filter((c) => c.startsWith('UNSUPPORTED') || c.startsWith('CLAIM'));

describe('template fallback drafts', () => {
  it.each([
    ['AUTH009', 'BK016', 'ROYALTY_PAYMENTS'],
    ['AUTH006', 'BK010', 'ROYALTY_PAYMENTS'],
    ['AUTH001', 'BK002', 'ROYALTY_PAYMENTS'],
    ['AUTH001', 'BK001', 'ISBN_METADATA'],
    ['AUTH001', 'BK001', 'PRINTING_QUALITY'],
    ['AUTH001', 'BK001', 'DISTRIBUTION_AVAILABILITY'],
    ['AUTH009', 'BK015', 'BOOK_STATUS_PRODUCTION'],
    ['AUTH001', null, 'GENERAL_INQUIRY'],
  ] as const)('%s %s %s contains only verified figures', (author, book, category) => {
    const d = templateDraft(draftInput(author, book, category));
    expect(figureIssues(d.check.issues.map((i) => i.code))).toEqual([]);
    expect(d.body).toMatch(/^Hi \w+,/);
  });

  it.each([
    ['AUTH009', 'BK016', 'ROYALTY_PAYMENTS'],
    ['AUTH001', 'BK001', 'ISBN_METADATA'],
    ['AUTH001', 'BK001', 'PRINTING_QUALITY'],
    ['AUTH001', 'BK001', 'DISTRIBUTION_AVAILABILITY'],
  ] as const)(
    '%s %s %s: without the knowledge-base facts, asks the agent instead of stating a figure (F-08)',
    (author, book, category) => {
      const full = draftInput(author, book, category);
      const facts = full.facts.filter((f) => !f.id.startsWith('kb.'));
      const d = templateDraft({ ...full, facts });
      expect(figureIssues(d.check.issues.map((i) => i.code))).toEqual([]);
      expect(d.body).toContain('[CONFIRM:');
    },
  );

  it('Kavita: explains the ₹850 roll-over below the ₹1,000 threshold', () => {
    const d = templateDraft(draftInput('AUTH009', 'BK016', 'ROYALTY_PAYMENTS'));
    expect(d.body).toContain('₹850');
    expect(d.body).toContain('rolls over');
  });

  it('Priya BK002: says nothing pending on this book but mentions ₹3,570 elsewhere', () => {
    const d = templateDraft(draftInput('AUTH001', 'BK002', 'ROYALTY_PAYMENTS'));
    expect(d.body).toContain('no royalty pending');
    expect(d.body).toContain('₹3,570');
    expect(d.body).not.toMatch(/fully paid/i);
  });
});

describe('AI drafts', () => {
  it("sends only this category's KB section and runs the checker on the result", async () => {
    const provider = fakeProvider(() => ({
      body: 'Hi Priya,\n\nYour pending royalty is ₹9,999 and will be paid soon.\n\nWarm regards,\nBookLeaf Author Support',
      claims: [{ quote: 'Your pending royalty is ₹9,999', factIds: ['author.total_pending'] }],
    }));
    const r = await runAiDraft(provider, 'm', draftInput('AUTH001', 'BK001', 'PRINTING_QUALITY'));
    const ctx = provider.calls[0]?.dynamicSystem ?? '';
    expect(ctx).toContain('Printing & Quality');
    expect(ctx).not.toContain('Royalty Policy');
    expect(r.draft.check.passed).toBe(false);
    expect(r.draft.check.issues.map((i) => i.code)).toContain('UNSUPPORTED_AMOUNT');
  });
});
