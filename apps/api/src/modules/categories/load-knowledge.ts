import { DEFAULT_AI_BEHAVIOUR } from '@bookleaf/shared';
import type { WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

/** The customer's AI behaviour settings (U-7), read with its knowledge for every prompt. */
const BEHAVIOUR_SELECT = {
  toneGuide: true,
  greeting: true,
  signature: true,
  replyLanguage: true,
  replyLength: true,
  formality: true,
  topicsToAvoid: true,
} as const;

/** Bounds on what one prompt can carry from the knowledge base. */
export const KNOWLEDGE_LIMITS = { articles: 100, bodyChars: 8_000 } as const;

/**
 * Article text, cached in this process. Each entry is keyed by the article and checked against
 * the article's `updatedAt`, which is read fresh on every load, so an admin's edit still applies
 * to the very next ticket on every server (knowledge edits publish no cache-sync invalidation;
 * this check is what keeps other copies right). The 60 s limit only bounds memory for articles
 * nobody asks about any more (a memory bound, not a point in time: the monotonic timer).
 */
const ARTICLE_TTL_MS = 60_000;
const MAX_CACHED_ARTICLES = 5_000;
interface CachedArticle {
  updatedAt: number;
  title: string;
  body: string;
  expiresAt: number;
}
const articleText = new Map<string, CachedArticle>();

const cacheKey = (workspaceId: string, id: string) => `${workspaceId}:${id}`;

function remember(
  workspaceId: string,
  row: { id: string; updatedAt: Date; title: string; body: string },
) {
  if (articleText.size >= MAX_CACHED_ARTICLES) {
    const oldest = articleText.keys().next().value;
    if (oldest !== undefined) articleText.delete(oldest);
  }
  articleText.set(cacheKey(workspaceId, row.id), {
    updatedAt: row.updatedAt.getTime(),
    title: row.title,
    body: row.body.slice(0, KNOWLEDGE_LIMITS.bodyChars),
    expiresAt: performance.now() + ARTICLE_TTL_MS,
  });
}

function cached(workspaceId: string, a: { id: string; updatedAt: Date }): CachedArticle | null {
  const hit = articleText.get(cacheKey(workspaceId, a.id));
  const fresh = hit && hit.updatedAt === a.updatedAt.getTime() && hit.expiresAt > performance.now();
  return fresh ? hit : null;
}

type ArticleStub = { id: string; updatedAt: Date; categories: { categoryKey: string }[] };

/** The text of each article, from the cache or (for any that changed) one query. */
async function articleTexts(db: Db, workspaceId: string, stubs: ArticleStub[]) {
  const missing = stubs.filter((a) => !cached(workspaceId, a)).map((a) => a.id);
  if (missing.length) {
    const rows = await db.knowledgeArticle.findMany({
      where: { workspaceId, id: { in: missing } },
      select: { id: true, updatedAt: true, title: true, body: true },
    });
    for (const row of rows) remember(workspaceId, row);
  }
  return stubs.map((a) => ({ stub: a, text: articleText.get(cacheKey(workspaceId, a.id)) }));
}

/** Everything but the article text, read fresh on every load. */
const readWorkspace = (db: Db, workspaceId: string) =>
  db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      isDefault: true,
      categories: { where: { isActive: true }, orderBy: ORDER },
      settings: { select: BEHAVIOUR_SELECT },
      articles: {
        where: { isActive: true },
        orderBy: ORDER,
        take: KNOWLEDGE_LIMITS.articles,
        select: { id: true, updatedAt: true, categories: { select: { categoryKey: true } } },
      },
    },
  });

/**
 * One workspace's active categories and articles, in display order: everything the AI may use
 * for this workspace's tickets and conversations. Categories, settings and which articles are
 * active are read fresh each time; at most 100 articles, each body cut to 8,000 characters.
 */
export async function loadWorkspaceKnowledge(
  db: Db,
  workspaceId: string,
): Promise<WorkspaceKnowledge> {
  const workspace = await readWorkspace(db, workspaceId);
  if (!workspace) throw new NotFoundError('Workspace');
  const active = new Set(workspace.categories.map((c) => c.key));
  const texts = await articleTexts(db, workspaceId, workspace.articles);
  return {
    workspaceName: workspace.name,
    publishingPack: workspace.isDefault,
    categories: workspace.categories.map((c) => ({
      key: c.key,
      label: c.label,
      description: c.description,
      defaultPriority: c.defaultPriority,
      slaHours: c.slaHours,
    })),
    articles: texts.flatMap(({ stub, text }) =>
      text
        ? [
            {
              title: text.title,
              body: text.body,
              categoryKeys: stub.categories.map((l) => l.categoryKey).filter((k) => active.has(k)),
            },
          ]
        : [],
    ),
    behaviour: workspace.settings ?? DEFAULT_AI_BEHAVIOUR,
  };
}

/**
 * A category key someone chose for a ticket must be one of the workspace's active categories.
 * Returns the category's own SLA hours (null = none), so the caller can work out the deadline.
 */
export async function assertActiveCategory(
  db: Db,
  workspaceId: string,
  key: string,
  path = 'category',
): Promise<{ slaHours: number | null }> {
  const found = await db.category.findFirst({
    where: { workspaceId, key, isActive: true },
    select: { slaHours: true },
  });
  if (!found)
    throw new ValidationError('Choose one of the workspace’s active categories.', [
      { path, message: 'Not an active category of this workspace' },
    ]);
  return found;
}
