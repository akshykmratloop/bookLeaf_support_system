import { describe, expect, it } from 'vitest';
import { BOOKLEAF_ARTICLES } from '../../modules/categories/bookleaf-knowledge.js';
import { voiceTools } from '../../voice/call/tool-defs.js';
import { chatSystem } from '../chat/prompt.v1.js';
import { toDraftAction } from '../chat/draft-action.js';
import { templateDraft } from '../drafting/service.js';
import type { DraftInput } from '../drafting/types.js';
import { draftContext, draftSystem } from '../prompts/draft.v1.js';
import { triageSystem } from '../prompts/triage.v1.js';
import { fakeProvider } from '../providers/fake/provider.js';
import { fallbackTriage, runAiTriage } from '../triage/service.js';
import type { WorkspaceKnowledge } from './knowledge.js';

const ACME: WorkspaceKnowledge = {
  workspaceName: 'Acme Corp',
  publishingPack: false,
  categories: [
    {
      key: 'BILLING',
      label: 'Billing',
      description: 'invoices, refunds and card charges',
      defaultPriority: 'HIGH',
      slaHours: 8,
    },
    {
      key: 'GENERAL_INQUIRY',
      label: 'General Inquiry',
      description: 'any other question',
      defaultPriority: 'LOW',
      slaHours: null,
    },
  ],
  articles: [
    { title: 'Refund policy', body: 'Refunds within 14 days.', categoryKeys: ['BILLING'] },
    { title: 'Office hours', body: 'Mon–Fri, 9–5.', categoryKeys: [] },
  ],
};

/** Phrases only BookLeaf's built-in prompts, policy and examples contain. */
const BOOKLEAF_TEXT = [
  'BookLeaf',
  'royalt',
  'ISBN',
  '₹1,000',
  '45 days',
  '48 hours',
  ...BOOKLEAF_ARTICLES.map((a) => a.title),
];
const expectNoBookleaf = (text: string) => {
  for (const phrase of BOOKLEAF_TEXT) expect(text).not.toContain(phrase);
};

const ticket = { subject: 'Charged twice', bookTitle: null, bookStage: null, royaltyStatus: null };

describe('another workspace (Acme) gets only its own categories and articles', () => {
  it("triages into Acme's categories, with Acme's wording only", async () => {
    const provider = fakeProvider((req) => {
      const schema = JSON.stringify(req);
      expect(schema).not.toContain('ROYALTY_PAYMENTS');
      return {
        category: 'BILLING',
        priority: 'MEDIUM',
        priorityReasons: ['double charge'],
        needsInfo: [],
        confidence: 'high',
      };
    });
    const r = await runAiTriage(
      provider,
      'm',
      { ...ticket, description: 'Card charged twice' },
      ACME,
    );
    expect(r.decision.category).toBe('BILLING');
    const system = provider.calls[0]?.stableSystem ?? '';
    expect(system).toContain(
      '- BILLING: invoices, refunds and card charges (usual priority: HIGH)',
    );
    expectNoBookleaf(system);
    expect(triageSystem(ACME)).toBe(system);
  });

  it('refuses a model answer outside its categories', async () => {
    const provider = fakeProvider(() => ({
      category: 'ROYALTY_PAYMENTS',
      priority: 'LOW',
      priorityReasons: [],
      needsInfo: [],
      confidence: 'high',
    }));
    await expect(
      runAiTriage(provider, 'm', { ...ticket, description: 'x' }, ACME),
    ).rejects.toThrow();
  });

  it("falls back by the categories' own words, else to General Inquiry", () => {
    const refund = fallbackTriage(
      { ...ticket, description: 'I want a refund for the invoice' },
      ACME,
    );
    expect(refund).toMatchObject({ category: 'BILLING', priority: 'HIGH', source: 'RULES' });
    const vague = fallbackTriage({ ...ticket, subject: 'Hello', description: 'Hi there' }, ACME);
    expect(vague).toMatchObject({ category: 'GENERAL_INQUIRY', priority: 'LOW' });
  });

  it("a draft gets only the articles linked to the ticket's category, never BookLeaf policy", () => {
    const input = {
      category: 'BILLING',
      knowledge: ACME,
      authorFirstName: 'Sam',
      bookTitle: null,
      facts: [],
      subject: 'Charged twice',
      authorMessages: ['Please refund'],
      lastTeamReply: null,
    };
    const context = draftContext(input);
    expect(context).toContain('Refund policy\nRefunds within 14 days.');
    expect(context).not.toContain('Office hours');
    expectNoBookleaf(context);
    expectNoBookleaf(draftSystem(ACME));
    expect(draftSystem(ACME)).toContain('Warm regards,\\nAcme Corp Support');
    expect(draftContext({ ...input, category: 'GENERAL_INQUIRY' })).toContain('(none:');
  });

  it('the template fallback draft has no BookLeaf text and signs as Acme', () => {
    const input: DraftInput = {
      category: 'BILLING',
      knowledge: ACME,
      authorName: 'Sam Lee',
      book: null,
      facts: [],
      royalty: {
        bookStatus: null,
        authorTotalPendingPaise: null,
        payoutEligible: null,
      } as unknown as DraftInput['royalty'],
      subject: 'Charged twice',
      authorMessages: ['Please refund'],
      lastTeamReply: null,
      ignorePhrases: [],
    };
    const body = templateDraft(input).body;
    expectNoBookleaf(body);
    expect(body).toMatch(/^Hi Sam,/);
    expect(body).toContain('Acme Corp Support');
  });

  it('the assistant and voice see all Acme articles and only Acme issue types', () => {
    const system = chatSystem(ACME);
    expect(system).toContain('Refund policy');
    expect(system).toContain('Office hours');
    expect(system).toContain('- BILLING | Billing');
    for (const a of BOOKLEAF_ARTICLES) expect(system).not.toContain(a.body.slice(0, 40));
    const enumOf = JSON.stringify(voiceTools(ACME)[0]?.parameters);
    expect(enumOf).toContain('"BILLING"');
    expect(enumOf).not.toContain('ROYALTY_PAYMENTS');
  });

  it("ignores a model's draft category that is not an active Acme category", () => {
    const out = {
      action: 'update' as const,
      bookId: null,
      subject: 'Refund please',
      description: null,
    };
    const choices = { books: [], knowledge: ACME };
    expect(toDraftAction({ ...out, category: 'ROYALTY_PAYMENTS' }, choices).patch).toEqual({
      subject: 'Refund please',
    });
    expect(toDraftAction({ ...out, category: 'BILLING' }, choices).patch.category).toBe('BILLING');
  });
});
