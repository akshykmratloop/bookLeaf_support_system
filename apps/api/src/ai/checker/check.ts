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
import { allowedValues, type Allowed } from './allowed.js';
import { findLoose } from './loose.js';
import { wordsToDigits } from './number-words.js';
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

function unsupported<T>(
  found: Found<T>[],
  allowed: Set<T>,
  code: string,
  what: string,
): CheckIssue[] {
  const seen = new Set<string>();
  // NaN marks a malformed figure ("₹1,0000"): it never matches a fact.
  const isAllowed = (v: T) => !(typeof v === 'number' && Number.isNaN(v)) && allowed.has(v);
  return found
    .filter((f) => !isAllowed(f.value))
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
  const loose = findLoose(text);
  return [
    ...unsupported(findMoney(text), allowed.money, 'UNSUPPORTED_AMOUNT', 'Amount'),
    ...unsupported(findDates(text), allowed.dates, 'UNSUPPORTED_DATE', 'Date'),
    ...unsupported(findDurations(text), allowed.durations, 'UNSUPPORTED_TIMELINE', 'Timeline'),
    ...unsupported(findPercents(text), allowed.percents, 'UNSUPPORTED_PERCENT', 'Percentage'),
    ...unsupported(findCopyCounts(text), allowed.counts, 'UNSUPPORTED_COUNT', 'Copy count'),
    ...unsupported(loose.foreign, allowed.foreign, 'UNSUPPORTED_AMOUNT', 'Amount'),
    ...unsupported(loose.shortDates, allowed.monthDays, 'UNSUPPORTED_DATE', 'Date'),
    ...unsupported(loose.longDurations, allowed.durations, 'UNSUPPORTED_TIMELINE', 'Timeline'),
    ...unsupported(loose.bare, allowed.figures, 'UNSUPPORTED_AMOUNT', 'Figure'),
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
    if (c.factIds.length === 0)
      return [issue('CLAIM_WITHOUT_EVIDENCE', `Claim cites no evidence: "${c.quote}".`, c.quote)];
    return c.factIds.flatMap((id) => {
      const fact = byId.get(id);
      if (!fact)
        return [
          issue('CLAIM_WITHOUT_EVIDENCE', `Claim cites unknown evidence: "${c.quote}".`, c.quote),
        ];
      if (fact.type === 'UNKNOWN')
        return [
          issue(
            'CLAIM_ON_UNKNOWN',
            `Claim relies on "${fact.label}", which BookLeaf does not know.`,
            c.quote,
          ),
        ];
      return [];
    });
  });
}

function phraseIssues(body: string): CheckIssue[] {
  return PHRASE_RULES.flatMap((rule) => {
    const m = body.match(rule.pattern);
    return m
      ? [
          {
            code: rule.code,
            severity: 'BLOCK' as const,
            message: rule.message,
            excerpt: m[0],
            overridable: rule.overridable,
          },
        ]
      : [];
  });
}

function shapeIssues(body: string): CheckIssue[] {
  const len = body.trim().length;
  if (len < MIN_LENGTH)
    return [
      { code: 'TOO_SHORT', severity: 'WARN', message: 'Reply is very short.', overridable: true },
    ];
  if (len > MAX_LENGTH)
    return [
      {
        code: 'TOO_LONG',
        severity: 'WARN',
        message: 'Reply is long; authors prefer concise answers.',
        overridable: true,
      },
    ];
  return [];
}

/**
 * Independent of the model: scans the text itself, so a draft cannot pass by omitting claims.
 * Every channel reads number words ("ten thousand rupees") as digits, not only voice.
 * Placeholders always block and cannot be overridden: an admin must fill them in.
 */
export function checkReply(input: CheckInput): CheckResult {
  const placeholders = findPlaceholders(input.body);
  const withoutPlaceholders = input.body.replace(/\[CONFIRM:[^\]]*\]/gi, ' ');
  // Titles come out first (a title may spell a number), then number words become digits.
  const scanText = wordsToDigits(
    stripExclusions(withoutPlaceholders, [...(input.ignorePhrases ?? [])]),
  );
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
