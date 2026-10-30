import type { WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

/**
 * One workspace's active categories and articles, in display order: everything the AI may use
 * for this workspace's tickets and conversations. Read fresh each time (two indexed queries),
 * so an admin's edit applies to the very next ticket on every server.
 */
export async function loadWorkspaceKnowledge(
  db: Db,
  workspaceId: string,
): Promise<WorkspaceKnowledge> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      isDefault: true,
      categories: { where: { isActive: true }, orderBy: ORDER },
      articles: {
        where: { isActive: true },
        orderBy: ORDER,
        include: { categories: { select: { categoryKey: true } } },
      },
    },
  });
  if (!workspace) throw new NotFoundError('Workspace');
  const active = new Set(workspace.categories.map((c) => c.key));
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
    articles: workspace.articles.map((a) => ({
      title: a.title,
      body: a.body,
      categoryKeys: a.categories.map((l) => l.categoryKey).filter((k) => active.has(k)),
    })),
  };
}

/** A category key someone chose for a ticket must be one of the workspace's active categories. */
export async function assertActiveCategory(
  db: Db,
  workspaceId: string,
  key: string,
  path = 'category',
): Promise<void> {
  const found = await db.category.count({ where: { workspaceId, key, isActive: true } });
  if (!found)
    throw new ValidationError('Choose one of the workspace’s active categories.', [
      { path, message: 'Not an active category of this workspace' },
    ]);
}
