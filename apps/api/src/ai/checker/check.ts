import type { CheckIssue, CheckResult, Fact } from '@bookleaf/shared';
import {
  findCopyCounts,
  findDates,
  findDurations,
  findMoney,
  findPercents,
  findPlaceholders,
  stripExclusions,
  type Found,
} from './extract.js';
import { PHRASE_RULES } from './phrases.js';

/** A statement the model says it made, pointing at the fact that supports it. */
export interface DraftClaim {
  quote: string;
  factIds: string[];
}

export interface CheckInput {
  body: string;
  facts: readonly Fact[];
  claims?: readonly DraftClaim[];
  /** Book titles and names: may contain digits that are not claims. */
  ignorePhrases?: readonly string[];
}

const MIN_LENGTH = 40;
const MAX_LENGTH = 2500;

interface Allowed {
  money: Set<number>;
  dates: Set<string>;
  durations: Set<string>;
  percents: Set<number>;
  counts: Set<number>;
}

/** Everything a reply may quote: typed fact values plus figures inside fact display text. */
function allowedValues(facts: readonly Fact[]): Allowed {
  const a: Allowed = { money: new Set(), dates: new Set(), durations: new Set(), percents: new Set(), counts: new Set() };
  for (const f of facts) {
    if (f.type === 'UNKNOWN') continue;
    if (f.type === 'MONEY' && typeof f.value === 'number') a.money.add(f.value);
    if (f.type === 'DATE' && typeof f.value === 'string') a.dates.add(f.value);
    if (f.type === 'PERCENT' && typeof f.value === 'number') a.percents.add(f.value);
    if (f.type === 'COUNT' && typeof f.value === 'number') a.counts.add(f.value);
    if (f.type === 'DURATION' && typeof f.value === 'string') a.durations.add(f.value);
    findMoney(f.display).forEach((m) => a.money.add(m.value));
    findDates(f.display).forEach((d) => a.dates.add(d.value));
    findDurations(f.display).forEach((d) => a.durations.add(d.value));
    findCopyCounts(f.display).forEach((c) => a.counts.add(c.value));
  }
  return a;
}

function unsupported<T>(found: Found<T>[], allowed: Set<T>, code: string, what: string): CheckIssue[] {
  const seen = new Set<string>();
  return found
    .filter((f) => !allowed.has(f.value))
    .filter((f) => (seen.has(f.raw) ? false : (seen.add(f.raw), true)))
    .map((f) => ({
      code,
      severity: 'BLOCK' as const,
      message: `${what} "${f.raw}" does not match any verified fact.`,
      excerpt: f.raw,
      overridable: true,
    }));
}

function figureIssues(text: string, allowed: Allowed): CheckIssue[] {
  return [
    ...unsupported(findMoney(text), allowed.money, 'UNSUPPORTED_AMOUNT', 'Amount'),
    ...unsupported(findDates(text), allowed.dates, 'UNSUPPORTED_DATE', 'Date'),
    ...unsupported(findDurations(text), allowed.durations, 'UNSUPPORTED_TIMELINE', 'Timeline'),
    ...unsupported(findPercents(text), allowed.percents, 'UNSUPPORTED_PERCENT', 'Percentage'),
    ...unsupported(findCopyCounts(text), allowed.counts, 'UNSUPPORTED_COUNT', 'Copy count'),
  ];
}

function claimIssues(claims: readonly DraftClaim[], facts: readonly Fact[]): CheckIssue[] {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const issue = (code: string, message: string, quote: string): CheckIssue => ({
    code,
    severity: 'BLOCK',
    message,
    excerpt: quote,
    overridable: true,
  });
  return claims.flatMap((c) => {
    // A claim that is itself a placeholder asserts nothing; the PLACEHOLDER rule already blocks it.
    if (/\[CONFIRM:/i.test(c.quote)) return [];
    if (c.factIds.length === 0) return [issue('CLAIM_WITHOUT_EVIDENCE', `Claim cites no evidence: "${c.quote}".`, c.quote)];
    return c.factIds.flatMap((id) => {
      const fact = byId.get(id);
      if (!fact) return [issue('CLAIM_WITHOUT_EVIDENCE', `Claim cites unknown evidence: "${c.quote}".`, c.quote)];
      if (fact.type === 'UNKNOWN') return [issue('CLAIM_ON_UNKNOWN', `Claim relies on "${fact.label}", which BookLeaf does not know.`, c.quote)];
      return [];
    });
  });
}

function phraseIssues(body: string): CheckIssue[] {
  return PHRASE_RULES.flatMap((rule) => {
    const m = body.match(rule.pattern);
    return m ? [{ code: rule.code, severity: 'BLOCK' as const, message: rule.message, excerpt: m[0], overridable: rule.overridable }] : [];
  });
}

function shapeIssues(body: string): CheckIssue[] {
  const len = body.trim().length;
  if (len < MIN_LENGTH) return [{ code: 'TOO_SHORT', severity: 'WARN', message: 'Reply is very short.', overridable: true }];
  if (len > MAX_LENGTH) return [{ code: 'TOO_LONG', severity: 'WARN', message: 'Reply is long; authors prefer concise answers.', overridable: true }];
  return [];
}

/**
 * Independent of the model: scans the text itself, so a draft cannot pass by omitting claims.
 * Placeholders always block and cannot be overridden: an admin must fill them in.
 */
export function checkReply(input: CheckInput): CheckResult {
  const placeholders = findPlaceholders(input.body);
  const withoutPlaceholders = input.body.replace(/\[CONFIRM:[^\]]*\]/gi, ' ');
  const scanText = stripExclusions(withoutPlaceholders, [...(input.ignorePhrases ?? [])]);
  const issues: CheckIssue[] = [
    ...placeholders.map((p) => ({
      code: 'PLACEHOLDER',
      severity: 'BLOCK' as const,
      message: 'Fill in this placeholder before sending.',
      excerpt: p,
      overridable: false,
    })),
    ...figureIssues(scanText, allowedValues(input.facts)),
    ...claimIssues(input.claims ?? [], input.facts),
    ...phraseIssues(withoutPlaceholders),
    ...shapeIssues(input.body),
  ];
  return { passed: !issues.some((i) => i.severity === 'BLOCK'), issues, placeholders };
}

/** True when every BLOCK issue may be overridden with a written reason. */
export function canOverride(result: CheckResult): boolean {
  return result.issues.filter((i) => i.severity === 'BLOCK').every((i) => i.overridable);
}
