import { CustomerFieldInputSchema } from '@bookleaf/shared';
import type { Db } from '../platform/db.js';
import { hashPassword } from '../modules/auth/password.js';
import { DEFAULT_AI_SETTINGS } from '../ai/providers/catalog.js';
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  DEFAULT_WORKSPACE_SLUG,
} from '../modules/workspaces/constants.js';
import { BOOKLEAF_FIELDS } from '../modules/settings/bookleaf-fields.js';
import { DEMO_ADMINS } from './demo-accounts.js';

/** BookLeaf's customer-data schema, as the default workspace's editable field rows. */
async function seedFields(db: Db, workspaceId: string): Promise<void> {
  for (const f of BOOKLEAF_FIELDS) {
    const parsed = CustomerFieldInputSchema.parse(f);
    await db.customerField.upsert({
      where: { workspaceId_key: { workspaceId, key: parsed.key } },
      update: {},
      create: { ...parsed, workspaceId },
    });
  }
}

/**
 * The support module's own starting data: the support team's admin accounts and the default
 * AI settings. Authors and books are not seeded here: they belong to the host product and
 * appear when an author first signs in through it. Idempotent (upserts only).
 */
export async function seedCore(db: Db, adminPassword: string): Promise<{ admins: number }> {
  const passwordHash = await hashPassword(adminPassword);
  const workspaceId = DEFAULT_WORKSPACE_ID;
  await db.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: {
      id: workspaceId,
      slug: DEFAULT_WORKSPACE_SLUG,
      name: DEFAULT_WORKSPACE_NAME,
      isDefault: true,
    },
  });
  for (const admin of DEMO_ADMINS) {
    const user = await db.user.upsert({
      where: { workspaceId_email: { workspaceId, email: admin.email } },
      update: { name: admin.name },
      create: { ...admin, workspaceId, role: 'ADMIN', passwordHash },
    });
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: {},
      create: { workspaceId, userId: user.id, role: 'OWNER' },
    });
  }
  await seedFields(db, workspaceId);
  await db.aiSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_AI_SETTINGS },
  });
  return { admins: DEMO_ADMINS.length };
}
