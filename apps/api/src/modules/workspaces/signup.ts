import type { SignupRequest, SignupResponse } from '@bookleaf/shared';
import type { Prisma } from '@prisma/client';
import type { Clock } from '../../platform/clock.js';
import { isUniqueViolation, isUniqueViolationOn, type Db } from '../../platform/db.js';
import { ConflictError } from '../../platform/errors.js';
import { hashPassword } from '../auth/password.js';
import { loginEmailOf } from '../auth/service.js';
import { toWorkspaceDto } from './mappers.js';

const SLUG_TAKEN = () =>
  new ConflictError('SLUG_TAKEN', 'That workspace name is already taken. Try another.');

/** A staff email has one account on the whole platform (F-12). */
const EMAIL_TAKEN = () =>
  new ConflictError('EMAIL_TAKEN', 'That email already has an account. Sign in instead.');

/**
 * Self-serve signup: a new workspace with its first OWNER, who signs in with a password as
 * support staff (role ADMIN). Everything the workspace needs later (connector, fields, settings)
 * is configured from the UI afterwards. One transaction: no half-made workspace.
 */
interface NewOwner {
  input: SignupRequest;
  passwordHash: string;
  now: Date;
}

async function createOwner(tx: Prisma.TransactionClient, workspaceId: string, o: NewOwner) {
  const user = await tx.user.create({
    data: {
      workspaceId,
      email: loginEmailOf(o.input.email),
      loginEmail: loginEmailOf(o.input.email),
      name: o.input.ownerName,
      role: 'ADMIN',
      passwordHash: o.passwordHash,
      createdAt: o.now,
    },
  });
  await tx.workspaceMember.create({
    data: { workspaceId, userId: user.id, role: 'OWNER', createdAt: o.now },
  });
  return user;
}

async function insertWorkspace(tx: Prisma.TransactionClient, o: NewOwner) {
  const workspace = await tx.workspace.create({
    data: { slug: o.input.slug, name: o.input.workspaceName, createdAt: o.now },
  });
  const user = await createOwner(tx, workspace.id, o);
  await tx.auditEvent.create({
    data: {
      workspaceId: workspace.id,
      actorId: user.id,
      entityType: 'workspace',
      entityId: workspace.id,
      action: 'workspace.created',
      after: { slug: workspace.slug, name: workspace.name },
      createdAt: o.now,
    },
  });
  return { workspace, user };
}

async function refuseTakenEmail(db: Db, email: string): Promise<void> {
  const taken = await db.user.findUnique({
    where: { loginEmail: loginEmailOf(email) },
    select: { id: true },
  });
  if (taken) throw EMAIL_TAKEN();
}

export async function signup(
  deps: { db: Db; clock: Clock },
  input: SignupRequest,
): Promise<SignupResponse> {
  await refuseTakenEmail(deps.db, input.email);
  const owner = { input, passwordHash: await hashPassword(input.password), now: deps.clock.now() };
  try {
    const { workspace, user } = await deps.db.$transaction((tx) => insertWorkspace(tx, owner));
    return {
      workspace: toWorkspaceDto(workspace),
      user: { id: user.id, email: user.email, name: user.name },
    };
  } catch (err) {
    // A signup racing this one for the same email loses on the unique index.
    if (isUniqueViolationOn(err, 'login_email')) throw EMAIL_TAKEN();
    if (isUniqueViolation(err)) throw SLUG_TAKEN();
    throw err;
  }
}
