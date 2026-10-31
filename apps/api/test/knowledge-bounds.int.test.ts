import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_LIMITS,
  loadWorkspaceKnowledge,
} from '../src/modules/categories/load-knowledge.js';
import { createHarness, deleteWorkspace, type Harness } from './helpers/app.js';
import { ownerOf, signupWorkspace } from './helpers/workspaces.js';

/** What one prompt may carry from a workspace's knowledge base, and that edits still apply. */
let h: Harness;
let workspaceId: string;
const WS = ownerOf('knowledge-bounds', 'Bounds Ltd');

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '10' } });
  await deleteWorkspace(h.db, WS.slug);
  await signupWorkspace(h, WS);
  workspaceId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: WS.slug } })).id;
  await h.db.knowledgeArticle.createMany({
    data: Array.from({ length: 105 }, (_, i) => ({
      workspaceId,
      title: `Article ${String(i).padStart(3, '0')}`,
      body: i === 0 ? 'x'.repeat(9_000) : `Body ${i}`,
      position: i,
    })),
  });
});
afterAll(async () => {
  await deleteWorkspace(h.db, WS.slug);
  await h.close();
});

describe('workspace knowledge for a prompt', () => {
  it('carries at most 100 active articles, each body cut to 8,000 characters', async () => {
    const k = await loadWorkspaceKnowledge(h.db, workspaceId);
    expect(k.articles).toHaveLength(KNOWLEDGE_LIMITS.articles);
    expect(k.articles[0]?.body).toHaveLength(KNOWLEDGE_LIMITS.bodyChars);
    expect(k.articles[99]?.title).toBe('Article 099');
  });

  it('serves an edited or deactivated article at once, not the cached text', async () => {
    await loadWorkspaceKnowledge(h.db, workspaceId);
    const first = await h.db.knowledgeArticle.findFirstOrThrow({
      where: { workspaceId, position: 1 },
    });
    await h.db.knowledgeArticle.update({ where: { id: first.id }, data: { body: 'Edited body' } });
    const edited = await loadWorkspaceKnowledge(h.db, workspaceId);
    expect(edited.articles.find((a) => a.title === first.title)?.body).toBe('Edited body');
    await h.db.knowledgeArticle.update({ where: { id: first.id }, data: { isActive: false } });
    const hidden = await loadWorkspaceKnowledge(h.db, workspaceId);
    expect(hidden.articles.some((a) => a.title === first.title)).toBe(false);
  });
});
