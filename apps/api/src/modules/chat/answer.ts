import type { CheckResult, ChatAnswerSource, Fact, TicketDraft } from '@bookleaf/shared';
import type { DraftAction } from '../../ai/chat/draft-action.js';
import { CHAT_PROMPT_VERSION } from '../../ai/chat/prompt.v1.js';
import { quickAnswer } from '../../ai/chat/quick/answers.js';
import { answerChat } from '../../ai/chat/service.js';
import { recordRun } from '../../ai/jobs/runs.js';
import { AiError } from '../../ai/providers/errors.js';
import type { Db } from '../../platform/db.js';
import type { AssistantService, ChatAccess } from '../assistant/service.js';
import { loadAuthorView, type AuthorView } from '../../host/author.js';
import type { HostRecords } from '../../host/types.js';
import type { WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import { loadWorkspaceKnowledge } from '../categories/load-knowledge.js';

export interface StoredAnswer {
  source: ChatAnswerSource;
  body: string;
  factsUsed: { id: string; label: string; display: string }[];
  check: CheckResult | null;
  /** Ticket draft change requested by the AI; null for instant and "unavailable" answers. */
  draft: DraftAction | null;
  model: string | null;
  latencyMs: number | null;
}

export const UNAVAILABLE_TEXT =
  "Sorry, I can't answer right now because the assistant is unavailable. You can still raise a ticket and the support team will reply to you.";

interface Deps {
  db: Db;
  records: HostRecords;
  assistant: AssistantService;
}

export interface AnswerRequest {
  workspaceId: string;
  authorId: string;
  message: string;
  history: { role: 'AUTHOR' | 'ASSISTANT'; body: string }[];
  draft: TicketDraft | null;
}

function unavailable(): StoredAnswer {
  return {
    source: 'UNAVAILABLE',
    body: UNAVAILABLE_TEXT,
    factsUsed: [],
    check: null,
    draft: null,
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

type TurnContext = AuthorView & { ignorePhrases: string[]; knowledge: WorkspaceKnowledge };

async function loadTurn(deps: Deps, req: AnswerRequest): Promise<TurnContext> {
  const [author, knowledge] = await Promise.all([
    loadAuthorView(deps, req.authorId),
    loadWorkspaceKnowledge(deps.db, req.workspaceId),
  ]);
  return { ...author, ignorePhrases: author.books.map((b) => b.title), knowledge };
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
    draft: null,
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
    knowledge: turn.knowledge,
    authorFirstName: turn.firstName,
    books: turn.books,
    facts: turn.facts,
    history: req.history,
    message: req.message,
    draft: req.draft,
    ignorePhrases: turn.ignorePhrases,
  });
}

/** The model's answer as saved: the facts it used, the last model and the total time. */
function toStored(
  res: Awaited<ReturnType<typeof runModel>>,
  turn: Awaited<ReturnType<typeof loadTurn>>,
  fallbackModel: string,
): StoredAnswer {
  return {
    source: res.source,
    body: res.body,
    factsUsed: factRefs(res.factIds, turn.facts),
    check: res.check,
    draft: res.draft,
    model: res.runs[res.runs.length - 1]?.model ?? fallbackModel,
    latencyMs: res.runs.reduce((sum, r) => sum + r.latencyMs, 0),
  };
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
  const access = await deps.assistant.chatAccess(req.workspaceId);
  if (!access.ok) return unavailable();
  const log = {
    ticketId: null,
    workspaceId: req.workspaceId,
    task: 'CHAT',
    provider: access.providerId,
    model: access.model,
  };
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
    return toStored(res, turn, access.model);
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    await recordRun(deps.db, {
      ...log,
      promptVersion: CHAT_PROMPT_VERSION,
      usage: null,
      latencyMs: Math.round(performance.now() - started),
      errorCode: err.code,
    });
    return unavailable();
  }
}
