import type { FailedDelivery, OnboardingFacts } from './facts.js';
import { broken, done, plural, todo, type StepResult } from './step-result.js';

/** The setup guide's steps 5 to 8: allowed websites, teaching the AI, extras, the first ticket. */

const SHOWN_ORIGINS = 3;

export function originsStep({ allowedOrigins: list }: OnboardingFacts): StepResult {
  if (list.length === 0) return todo('No website is allowed to show the widget yet.');
  const shown = list.slice(0, SHOWN_ORIGINS).join(', ');
  const more = list.length > SHOWN_ORIGINS ? ` and ${list.length - SHOWN_ORIGINS} more` : '';
  return done(`${plural(list.length, 'website')} allowed: ${shown}${more}.`);
}

export function teachStep({ categories, articles }: OnboardingFacts): StepResult {
  const counts = `${plural(categories, 'category', 'categories')}, ${plural(articles, 'knowledge article')}`;
  if (categories > 0 && articles > 0) return done(`${counts}.`);
  return todo(`${counts}. Add at least one of each.`);
}

const failureOf = (d: FailedDelivery) =>
  d.responseStatus !== null ? `HTTP ${d.responseStatus}` : (d.lastError ?? 'no answer');

export function extrasStep(f: OnboardingFacts): StepResult {
  if (f.failedDelivery)
    return broken(
      `A webhook delivery (${f.failedDelivery.event}) failed: ${failureOf(f.failedDelivery)}. Check the delivery log on Webhooks.`,
    );
  if (f.apiKeys + f.webhooks > 0)
    return done(`${plural(f.apiKeys, 'API key')}, ${plural(f.webhooks, 'webhook')}.`);
  return todo('Optional: only needed when your server calls support or wants its events.');
}

export function testStep(f: OnboardingFacts): StepResult {
  if (f.firstRealTicketAt)
    return done('The first ticket from a real customer has arrived.', f.firstRealTicketAt);
  if (f.testTicket)
    return todo(
      `Test ticket ${f.testTicket.label} sent. Waiting for the first ticket from a real customer.`,
    );
  return todo('Send a test ticket, then raise one from your product as a customer.');
}
