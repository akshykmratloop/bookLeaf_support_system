import type { Priority } from '@bookleaf/shared';

/** One of the workspace's active categories, as the AI sees it. */
export interface KnowledgeCategory {
  key: string;
  label: string;
  /** What belongs in this category, written for triage. */
  description: string;
  defaultPriority: Priority;
  slaHours: number | null;
}

/** One active knowledge-base article and the categories it is linked to. */
export interface KnowledgeArticle {
  title: string;
  body: string;
  categoryKeys: readonly string[];
}

/**
 * Everything the AI may know about one workspace's support policy (S.9): its own categories and
 * articles, in display order. Nothing here ever comes from another workspace.
 */
export interface WorkspaceKnowledge {
  workspaceName: string;
  /**
   * BookLeaf's publishing pack (built-in examples, templates and prompt wording) runs only for the
   * platform's default workspace, BookLeaf. Every other workspace gets the generic wording.
   */
  publishingPack: boolean;
  categories: readonly KnowledgeCategory[];
  articles: readonly KnowledgeArticle[];
}

/** The workspace's name for prompt text. It is admin input: one line, no angle brackets. */
export const workspaceNameText = (k: Pick<WorkspaceKnowledge, 'workspaceName'>): string =>
  k.workspaceName.replace(/[\r\n<>]+/g, ' ').trim();

/** The key every workspace starts with; the natural home for anything that fits nowhere else. */
export const GENERAL_CATEGORY_KEY = 'GENERAL_INQUIRY';

const articleText = (a: KnowledgeArticle) => `${a.title}\n${a.body}`;

/** All active articles, for the author assistant (chat and voice): it has no ticket yet. */
export function knowledgeText(k: WorkspaceKnowledge): string {
  return k.articles.map(articleText).join('\n\n');
}

/** Only the articles linked to this category: what a reply draft for its tickets may use. */
export function knowledgeTextFor(k: WorkspaceKnowledge, categoryKey: string): string {
  return k.articles
    .filter((a) => a.categoryKeys.includes(categoryKey))
    .map(articleText)
    .join('\n\n');
}

/** "- KEY | Label" lines for the assistant's ticket-draft issue types. */
export function issueTypesText(k: WorkspaceKnowledge): string {
  return k.categories.map((c) => `- ${c.key} | ${c.label}`).join('\n');
}

export const categoryOf = (k: WorkspaceKnowledge, key: string | null | undefined) =>
  key ? (k.categories.find((c) => c.key === key) ?? null) : null;

/**
 * Where a ticket goes when nothing better fits: the active General Inquiry category, else the
 * first active one. Null only if the workspace has no active category at all.
 */
export function fallbackCategory(k: WorkspaceKnowledge): KnowledgeCategory | null {
  return categoryOf(k, GENERAL_CATEGORY_KEY) ?? k.categories[0] ?? null;
}

export const categoryKeysOf = (k: WorkspaceKnowledge) => k.categories.map((c) => c.key);
