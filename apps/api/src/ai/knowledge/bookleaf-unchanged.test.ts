import { readFileSync } from 'node:fs';
import { LEGACY_TICKET_CATEGORIES } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { sampleCustomer } from '../../../test/fixtures/host.js';
import { factsFor } from '../../host/facts.js';
import { bookleafKnowledge } from '../../modules/categories/bookleaf-knowledge.js';
import { voiceTools } from '../../voice/call/tool-defs.js';
import { chatSystem } from '../chat/prompt.v1.js';
import { royaltySignals, stageOf } from '../domain/signals.js';
import { draftContext, draftSystem } from '../prompts/draft.v1.js';
import { triageSystem } from '../prompts/triage.v1.js';
import { fallbackTriage } from '../triage/service.js';

/**
 * S.9 moved BookLeaf's categories and knowledge base from code into its workspace rows. These
 * golden files are the prompts exactly as they were before the move: with the seeded rows,
 * BookLeaf's AI gets the same text, so the triage eval result (45/46) cannot change.
 */
const golden = (name: string) =>
  readFileSync(new URL(`../../../test/fixtures/golden/${name}`, import.meta.url), 'utf8');
const BOOKLEAF = bookleafKnowledge();

const contextFor = (category: string) =>
  draftContext({
    category,
    knowledge: BOOKLEAF,
    authorFirstName: 'A',
    bookTitle: null,
    facts: [],
    subject: 's',
    authorMessages: ['m'],
    lastTeamReply: null,
  });

describe('BookLeaf prompts built from its seeded workspace rows', () => {
  it('triage, draft and chat system prompts are byte-identical to before', () => {
    expect(triageSystem(BOOKLEAF)).toBe(golden('triage-system.txt'));
    expect(draftSystem(BOOKLEAF)).toBe(golden('draft-system.txt'));
    expect(chatSystem(BOOKLEAF)).toBe(golden('chat-system.txt'));
  });

  it('voice tools offer the same issue types', () => {
    expect(voiceTools(BOOKLEAF)).toEqual(JSON.parse(golden('voice-tools.json')));
  });

  it.each(LEGACY_TICKET_CATEGORIES.filter((c) => c !== 'BOOK_STATUS_PRODUCTION'))(
    'the %s draft context is byte-identical',
    (category) => expect(contextFor(category)).toBe(golden(`draft-context-${category}.txt`)),
  );

  it('the production draft context has the same two sections (now in knowledge-base order)', () => {
    const before = golden('draft-context-BOOK_STATUS_PRODUCTION.txt');
    const after = contextFor('BOOK_STATUS_PRODUCTION');
    expect(after.length).toBe(before.length);
    for (const part of ['Production Stages', 'Distribution & Availability', 'Example 1'])
      expect(after).toContain(part);
  });
});

interface EvalCase {
  id: string;
  author: string;
  book: string | null;
  subject: string;
  description: string;
}

const cases = readFileSync(new URL('../../../../../eval/dataset.jsonl', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as EvalCase);

describe('triage eval, no-AI part (eval/dataset.jsonl)', () => {
  it('the keyword fallback gives every case the same category and priority as before', () => {
    const before = JSON.parse(golden('fallback-triage.json')) as Record<string, unknown>;
    const after = Object.fromEntries(
      cases.map((c) => {
        const customer = sampleCustomer(c.author);
        const book = customer.items.find((i) => i.id === c.book) ?? null;
        const facts = factsFor(customer, book?.id ?? null);
        const d = fallbackTriage(
          {
            subject: c.subject,
            description: c.description,
            bookTitle: book?.title ?? null,
            bookStage: book ? stageOf(facts, book.id) : null,
            royaltyStatus: royaltySignals(facts, book?.id ?? null).bookStatus,
          },
          BOOKLEAF,
        );
        return [c.id, { category: d.category, priority: d.priority }];
      }),
    );
    expect(cases).toHaveLength(46);
    expect(after).toEqual(before);
  });
});
