/**
 * Triage evaluation: runs every labelled case through the live AI triage and through the
 * no-AI keyword fallback, then writes docs/eval-results.md. Usage: `pnpm eval`.
 * Costs a few cents (one fast-model call per case). Results are only as good as this small set.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sampleCustomer } from '../apps/api/test/fixtures/host.js';
import { factsFor } from '../apps/api/src/host/facts.js';
import { royaltySignals, stageOf } from '../apps/api/src/ai/domain/signals.js';
import { anthropicProvider } from '../apps/api/src/ai/providers/anthropic/provider.js';
import { DEFAULT_AI_SETTINGS } from '../apps/api/src/ai/providers/catalog.js';
import {
  fallbackTriage,
  runAiTriage,
  type TriageDecision,
  type TriageInput,
} from '../apps/api/src/ai/triage/service.js';
import { bookleafKnowledge } from '../apps/api/src/modules/categories/bookleaf-knowledge.js';
import { renderReport, type CaseResult, type EvalCase } from './report.js';

/** BookLeaf's categories exactly as its workspace is seeded (the prompt is unchanged by S.9). */
const BOOKLEAF = bookleafKnowledge();

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function loadCases(): EvalCase[] {
  return readFileSync(root('./dataset.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

/** The same input triage gets in production: the demo host's facts for the case's book. */
function toInput(c: EvalCase): TriageInput {
  const customer = sampleCustomer(c.author);
  const book = customer.items.find((i) => i.id === c.book) ?? null;
  const facts = factsFor(customer, book?.id ?? null);
  return {
    subject: c.subject,
    description: c.description,
    bookTitle: book?.title ?? null,
    bookStage: book ? stageOf(facts, book.id) : null,
    royaltyStatus: royaltySignals(facts, book?.id ?? null).bookStatus,
  };
}

function score(
  c: EvalCase,
  d: TriageDecision | null,
): Pick<CaseResult, 'categoryOk' | 'priorityOk'> {
  if (!d) return { categoryOk: false, priorityOk: false };
  return {
    categoryOk:
      d.category === c.category ||
      (d.category !== null && (c.alsoAccept ?? []).includes(d.category)),
    priorityOk: c.priority.includes(d.priority),
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set; the eval needs the live provider.');
  const provider = anthropicProvider({ apiKey });
  const model = process.argv[2] ?? DEFAULT_AI_SETTINGS.triageModel;
  const results: CaseResult[] = [];
  for (const c of loadCases()) {
    const input = toInput(c);
    const rules = fallbackTriage(input, BOOKLEAF);
    let ai: TriageDecision | null = null;
    let latencyMs = 0;
    let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let error: string | null = null;
    try {
      const run = await runAiTriage(provider, model, input, BOOKLEAF);
      ai = run.decision;
      latencyMs = run.run.latencyMs;
      usage = run.run.usage;
    } catch (err) {
      error = err instanceof Error ? err.name : 'Error';
    }
    results.push({
      case: c,
      ai,
      rules,
      latencyMs,
      error,
      ...usage,
      ...score(c, ai),
      rulesCategoryOk: score(c, rules).categoryOk,
      rulesPriorityOk: score(c, rules).priorityOk,
    });
    process.stdout.write(
      `${c.id}: ${ai ? `${ai.category}/${ai.priority}` : error} ${score(c, ai).categoryOk ? '✓' : '✗'}\n`,
    );
  }
  writeFileSync(
    root('../docs/eval-results.md'),
    renderReport(results, model, new Date().toISOString().slice(0, 10)),
  );
  process.stdout.write('Wrote docs/eval-results.md\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Eval failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
