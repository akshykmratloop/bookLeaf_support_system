import { CustomerFieldInputSchema } from '@bookleaf/shared';
import type { Db } from '../platform/db.js';
import { hashPassword } from '../modules/auth/password.js';
import { DEFAULT_AI_SETTINGS } from '../ai/providers/catalog.js';
import {
  DEFAULT_TICKET_PREFIX,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  DEFAULT_WORKSPACE_SLUG,
} from '../modules/workspaces/constants.js';
import { BOOKLEAF_FIELDS } from '../modules/settings/bookleaf-fields.js';
import { DEMO_ADMINS } from './demo-accounts.js';
import { seedBookleafKnowledge } from '../modules/categories/seed.js';

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
 * The support module's own starting data: the support team's admin accounts, the platform's
 * AI settings, BookLeaf's plan and BookLeaf's categories and knowledge base. Authors and books are not seeded here: they belong to the host product and
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
      ticketPrefix: DEFAULT_TICKET_PREFIX,
      isDefault: true,
    },
  });
  for (const admin of DEMO_ADMINS) {
    const user = await db.user.upsert({
      where: { workspaceId_email: { workspaceId, email: admin.email } },
      update: { name: admin.name, loginEmail: admin.email },
      create: { ...admin, loginEmail: admin.email, workspaceId, role: 'ADMIN', passwordHash },
    });
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: {},
      create: { workspaceId, userId: user.id, role: 'OWNER' },
    });
  }
  await seedFields(db, workspaceId);
  await seedBookleafKnowledge(db, workspaceId);
  // The platform's shared AI settings (U-7); the migration already made the row on most databases.
  await db.platformSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_AI_SETTINGS },
  });
  await db.workspacePlan.upsert({ where: { workspaceId }, update: {}, create: { workspaceId } });
  return { admins: DEMO_ADMINS.length };
}
