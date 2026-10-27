import type { CaseResult } from './report.js';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
/** Published claude-haiku-5-5 rates for prompts of 100K tokens or fewer (USD per million tokens). */
const HAIKU_RATE = { input: 0.1, output: 0.5 };

type Pick = (r: CaseResult) => string | undefined;
const accepted = (r: CaseResult, got: string | undefined) =>
  got === r.case.category || (r.case.alsoAccept ?? []).includes(got ?? '');

/** Macro-F1 over categories: the mean of each category's F1, so small categories count equally. */
export function macroF1(rs: CaseResult[], pick: Pick): number {
  const labels = [...new Set(rs.map((r) => r.case.category))];
  const f1s = labels.map((label) => {
    const tp = rs.filter((r) => r.case.category === label && accepted(r, pick(r))).length;
    const fp = rs.filter((r) => pick(r) === label && !accepted(r, pick(r))).length;
    const fn = rs.filter((r) => r.case.category === label && !accepted(r, pick(r))).length;
    return tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
  });
  return f1s.reduce((a, b) => a + b, 0) / labels.length;
}

/** Below the lowest accepted level is the risky miss (an urgent ticket waits). */
function priorityBand(r: CaseResult, got: string | undefined): 'ok' | 'under' | 'over' | 'none' {
  if (!got) return 'none';
  const idx = LEVELS.indexOf(got);
  const allowed = r.case.priority.map((p) => LEVELS.indexOf(p));
  if (allowed.includes(idx)) return 'ok';
  return idx < Math.min(...allowed) ? 'under' : 'over';
}

export function priorityTable(rs: CaseResult[]): string {
  const row = (name: string, pick: Pick) => {
    const bands = rs.map((r) => priorityBand(r, pick(r)));
    const n = (b: string) => bands.filter((x) => x === b).length;
    return `| ${name} | ${n('ok')} | ${n('under')} | ${n('over')} | ${n('none')} |`;
  };
  return [
    '| | Within accepted | Too low | Too high | No result |',
    '| --- | --- | --- | --- | --- |',
    row('AI triage', (r) => r.ai?.priority),
    row('Keyword fallback', (r) => r.rules.priority),
  ].join('\n');
}

export function costLine(rs: CaseResult[]): string {
  const sum = (f: (r: CaseResult) => number | undefined) => rs.reduce((a, r) => a + (f(r) ?? 0), 0);
  const input = sum((r) => r.inputTokens);
  const output = sum((r) => r.outputTokens);
  const cacheRead = sum((r) => r.cacheReadTokens);
  const cacheWrite = sum((r) => r.cacheWriteTokens);
  // Cache reads bill at 0.1x the input rate, 5-minute cache writes at 1.25x.
  const inputUnits = input + cacheRead * 0.1 + cacheWrite * 1.25;
  const usd = (inputUnits * HAIKU_RATE.input + output * HAIKU_RATE.output) / 1_000_000;
  const n = Math.max(rs.length, 1);
  return `Tokens across ${rs.length} calls: ${input} input, ${cacheRead} cache-read, ${cacheWrite} cache-write, ${output} output. Estimated cost at the published claude-haiku-5-5 rate ($0.10 / $0.50 per million; cache read 0.1x, cache write 1.25x): $${usd.toFixed(4)} (≈ $${((usd / n) * 1000).toFixed(2)} per 1,000 tickets).`;
}
