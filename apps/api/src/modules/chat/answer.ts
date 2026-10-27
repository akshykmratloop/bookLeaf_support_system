import type { CheckResult, ChatAnswerSource, Fact, TicketProposal } from '@bookleaf/shared';
import { buildAuthorFacts } from '../../ai/chat/author-facts.js';
import { CHAT_PROMPT_VERSION } from '../../ai/chat/prompt.v1.js';
import { toProposal } from '../../ai/chat/proposal.js';
import { quickAnswer } from '../../ai/chat/quick/answers.js';
import { answerChat } from '../../ai/chat/service.js';
import { recordRun } from '../../ai/jobs/runs.js';
import { AiError } from '../../ai/providers/errors.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import type { AssistantService, ChatAccess } from '../assistant/service.js';
import { loadAuthorRecord } from './repository.js';

export interface StoredAnswer {
  source: ChatAnswerSource;
  body: string;
  factsUsed: { id: string; label: string; display: string }[];
  check: CheckResult | null;
  proposal: TicketProposal | null;
  model: string | null;
  latencyMs: number | null;
}

export const UNAVAILABLE_TEXT =
  "Sorry, I can't answer right now because the assistant is unavailable. You can still raise a ticket and the support team will reply to you.";

interface Deps {
  db: Db;
  clock: Clock;
  assistant: AssistantService;
}

export interface AnswerRequest {
  authorId: string;
  message: string;
  history: { role: 'AUTHOR' | 'ASSISTANT'; body: string }[];
}

function unavailable(message: string): StoredAnswer {
  return {
    source: 'UNAVAILABLE',
    body: UNAVAILABLE_TEXT,
    factsUsed: [],
    check: null,
    proposal: toProposal({ subject: '', description: '', bookId: null }, [], message),
    model: null,
    latencyMs: null,
  };
}

const factRefs = (ids: string[], facts: Fact[]) => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return ids.flatMap((id) => {
    const f = byId.get(id);
    return f && f.type !== 'UNKNOWN' ? [{ id: f.id, label: f.label, display: f.display }] : [];
  });
};

type AuthorRecord = Awaited<ReturnType<typeof loadAuthorRecord>>;

interface TurnContext {
  author: AuthorRecord;
  facts: Fact[];
  firstName: string;
  ignorePhrases: string[];
}

/** Facts are picked from the recent topic too, so "is it on Flipkart?" keeps the book in view. */
const topicText = (req: AnswerRequest) =>
  [
    ...req.history
      .filter((m) => m.role === 'AUTHOR')
      .slice(-2)
      .map((m) => m.body),
    req.message,
  ].join(' ');

async function loadTurn(deps: Deps, req: AnswerRequest): Promise<TurnContext> {
  const author = await loadAuthorRecord(deps.db, req.authorId);
  return {
    author,
    facts: buildAuthorFacts(author, topicText(req), deps.clock.dataAsOf()),
    firstName: author.name.split(' ')[0] ?? author.name,
    ignorePhrases: author.books.map((b) => b.title),
  };
}

/** Common questions answered from verified records in milliseconds; null means "ask the AI". */
function fromRecords(req: AnswerRequest, turn: TurnContext, started: number): StoredAnswer | null {
  const quick = quickAnswer(req.message, turn);
  if (!quick) return null;
  return {
    source: 'RECORDS',
    body: quick.body,
    factsUsed: factRefs(quick.factIds, turn.facts),
    check: quick.check,
    proposal: null,
    model: null,
    latencyMs: Math.round(performance.now() - started),
  };
}

async function runModel(
  access: Extract<ChatAccess, { ok: true }>,
  req: AnswerRequest,
  turn: TurnContext,
) {
  return answerChat(access.provider, access.model, {
    authorFirstName: turn.firstName,
    books: turn.author.books.map((b) => ({ id: b.id, title: b.title })),
    facts: turn.facts,
    history: req.history,
    message: req.message,
    ignorePhrases: turn.ignorePhrases,
  });
}

/**
 * One assistant turn. Common questions are answered from records without the AI. Otherwise it
 * never throws for AI problems: a missing key, outage switch or provider error becomes an
 * "unavailable" answer with a ticket offer, and every model call is logged.
 */
export async function produceAnswer(deps: Deps, req: AnswerRequest): Promise<StoredAnswer> {
  const started = performance.now(); // elapsed time only
  const turn = await loadTurn(deps, req);
  const instant = fromRecords(req, turn, started);
  if (instant) return instant;
  const access = await deps.assistant.chatAccess();
  if (!access.ok) return unavailable(req.message);
  const log = { ticketId: null, task: 'CHAT', provider: access.providerId, model: access.model };
  try {
    const res = await runModel(access, req, turn);
    for (const run of res.runs)
      await recordRun(deps.db, {
        ...log,
        promptVersion: CHAT_PROMPT_VERSION,
        usage: run.usage,
        latencyMs: run.latencyMs,
        errorCode: null,
      });
    return {
      source: res.source,
      body: res.body,
      factsUsed: factRefs(res.factIds, turn.facts),
      check: res.check,
      proposal: res.proposal,
      model: res.runs[res.runs.length - 1]?.model ?? access.model,
      latencyMs: res.runs.reduce((sum, r) => sum + r.latencyMs, 0),
    };
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    await recordRun(deps.db, {
      ...log,
      promptVersion: CHAT_PROMPT_VERSION,
      usage: null,
      latencyMs: Math.round(performance.now() - started),
      errorCode: err.code,
    });
    return unavailable(req.message);
  }
}
