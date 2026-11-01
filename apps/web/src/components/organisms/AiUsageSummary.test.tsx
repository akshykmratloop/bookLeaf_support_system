import type { AiUsage } from '@bookleaf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiUsageSummary } from './AiUsageSummary';

const USAGE: AiUsage = {
  days: 30,
  since: '2026-10-03T00:00:00.000Z',
  totalCostMicros: 94_900,
  totalCredits: 94.9,
  features: [
    { feature: 'TRIAGE', unit: 'ticket', units: 2, costMicros: 600, costPerUnitMicros: 300 },
    { feature: 'DRAFT', unit: 'draft', units: 1, costMicros: 4_000, costPerUnitMicros: 4_000 },
    { feature: 'CHAT', unit: 'reply', units: 3, costMicros: 300, costPerUnitMicros: 100 },
    { feature: 'VOICE', unit: 'minute', units: 0, costMicros: 0, costPerUnitMicros: null },
  ],
  perTicketMicros: 2_300,
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('AiUsageSummary', () => {
  it('shows the 30-day total in dollars and credits', () => {
    const html = text(renderToStaticMarkup(<AiUsageSummary usage={USAGE} />));
    expect(html).toContain('Last 30 days');
    expect(html).toContain('$0.0949');
    expect(html).toContain('94.9 credits');
  });

  it('has one table row per feature: used, cost and cost per unit', () => {
    const html = renderToStaticMarkup(<AiUsageSummary usage={USAGE} />);
    expect(html.match(/<tr/g)).toHaveLength(5);
    for (const heading of ['Feature', 'Used', 'Cost', 'Cost per unit'])
      expect(html).toMatch(new RegExp(`<th scope="col"[^>]*>${heading}</th>`));
    const plain = text(html);
    expect(plain).toContain('Ticket sorting 2 tickets $0.0006 $0.0003 / ticket');
    expect(plain).toContain('Reply drafts 1 draft $0.004 $0.004 / draft');
    expect(plain).toContain('Author chat 3 replies $0.0003 $0.0001 / reply');
    // Nothing used: no per-unit figure.
    expect(plain).toContain('Voice calls 0 min $0.00 —');
  });

  it('shows the per-ticket cost and where the prices come from', () => {
    const plain = text(renderToStaticMarkup(<AiUsageSummary usage={USAGE} />));
    expect(plain).toContain('Per ticket (sort + draft): $0.0023');
    expect(plain).toContain('Prices are the AI providers’ published rates. 1 credit = $0.001.');
  });

  it('says so plainly when there is no AI usage yet', () => {
    const none: AiUsage = {
      ...USAGE,
      totalCostMicros: 0,
      totalCredits: 0,
      perTicketMicros: null,
      features: USAGE.features.map((f) => ({
        ...f,
        units: 0,
        costMicros: 0,
        costPerUnitMicros: null,
      })),
    };
    const plain = text(renderToStaticMarkup(<AiUsageSummary usage={none} />));
    expect(plain).toContain('No AI usage in the last 30 days');
    expect(plain).not.toContain('Cost per unit');
  });
});
