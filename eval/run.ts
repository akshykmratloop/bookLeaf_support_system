/**
 * Triage evaluation: runs every labelled case through the live AI triage and through the
 * no-AI keyword fallback, then writes docs/eval-results.md. Usage: `pnpm eval`.
 * Costs a few cents (one fast-model call per case). Results are only as good as this small set.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sampleAuthor } from '../apps/api/test/fixtures/sample-authors.js';
import { buildFactsPack } from '../apps/api/src/ai/facts/index.js';
import { anthropicProvider } from '../apps/api/src/ai/providers/anthropic/provider.js';
import { DEFAULT_AI_SETTINGS } from '../apps/api/src/ai/providers/catalog.js';
import {
  fallbackTriage,
  runAiTriage,
  type TriageDecision,
  type TriageInput,
} from '../apps/api/src/ai/triage/service.js';
import { renderReport, type CaseResult, type EvalCase } from './report.js';

const DATA_AS_OF = new Date('2025-12-31T00:00:00Z');
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function loadCases(): EvalCase[] {
  return readFileSync(root('./dataset.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

function toInput(c: EvalCase): TriageInput {
  const author = sampleAuthor(c.author);
  const book = author.books.find((b) => b.id === c.book) ?? null;
  const { royalty } = buildFactsPack({
    author,
    bookId: book?.id ?? null,
    text: '',
    dataAsOf: DATA_AS_OF,
  });
  return {
    subject: c.subject,
    description: c.description,
    bookTitle: book?.title ?? null,
    bookStage: book ? book.stage.replace(/_/g, ' ').toLowerCase() : null,
    royaltyStatus: royalty.bookStatus,
  };
}

function score(
  c: EvalCase,
  d: TriageDecision | null,
): Pick<CaseResult, 'categoryOk' | 'priorityOk'> {
  if (!d) return { categoryOk: false, priorityOk: false };
  return {
    categoryOk: d.category === c.category || (c.alsoAccept ?? []).includes(d.category),
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
    const rules = fallbackTriage(input);
    let ai: TriageDecision | null = null;
    let latencyMs = 0;
    let error: string | null = null;
    try {
      const run = await runAiTriage(provider, model, input);
      ai = run.decision;
      latencyMs = run.run.latencyMs;
    } catch (err) {
      error = err instanceof Error ? err.name : 'Error';
    }
    results.push({
      case: c,
      ai,
      rules,
      latencyMs,
      error,
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
