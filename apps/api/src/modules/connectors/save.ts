import type { SaveConnectorRequest } from '@bookleaf/shared';
import type { Prisma } from '@prisma/client';
import { hintOf } from '../../platform/crypto/envelope.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import { assertSafeUrl, UnsafeUrlError } from '../../platform/net/ssrf.js';
import type { Session } from '../auth/session.js';
import { aadFor, type ConnectorDeps } from './deps.js';
import { SecretsNotConfiguredError } from './store.js';

type FieldError = { path: string; message: string };

async function checkUrl(deps: ConnectorDeps, path: string, url: string | null | undefined) {
  if (!url) return null;
  try {
    await assertSafeUrl(url, deps.ssrf);
    return null;
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { path, message: err.message };
    throw err;
  }
}

/** Both URLs must be safe to fetch; the first save must bring both secrets. */
async function validate(deps: ConnectorDeps, input: SaveConnectorRequest, isNew: boolean) {
  const errors: FieldError[] = [];
  const urls = await Promise.all([
    checkUrl(deps, 'baseUrl', input.baseUrl),
    checkUrl(deps, 'signInUrl', input.signInUrl),
  ]);
  errors.push(...urls.filter((e): e is FieldError => e !== null));
  if (isNew && !input.apiKey) errors.push({ path: 'apiKey', message: 'Required the first time' });
  if (isNew && !input.signingSecret)
    errors.push({ path: 'signingSecret', message: 'Required the first time' });
  if (errors.length) throw new ValidationError('Invalid product connection', errors);
}

function encryptedFields(
  deps: ConnectorDeps,
  workspaceId: string,
  input: SaveConnectorRequest,
): Prisma.WorkspaceConnectorUncheckedUpdateInput {
  const env = deps.envelope;
  if (!env) throw new SecretsNotConfiguredError();
  return {
    ...(input.apiKey
      ? {
          apiKeyEnc: env.encrypt(input.apiKey, aadFor(workspaceId, 'apiKey')),
          apiKeyHint: hintOf(input.apiKey),
        }
      : {}),
    ...(input.signingSecret
      ? {
          signingSecretEnc: env.encrypt(input.signingSecret, aadFor(workspaceId, 'signingSecret')),
          signingSecretHint: hintOf(input.signingSecret),
        }
      : {}),
  };
}

const CONFLICT = () =>
  new ConflictError(
    'VERSION_CONFLICT',
    'The product connection was changed by someone else. Reload and try again.',
  );

/**
 * Creates or updates the workspace's connector. Secrets arrive once, are encrypted at rest and
 * never returned. Stale versions conflict. The save and its audit record are one transaction.
 */
export async function saveConnector(
  deps: ConnectorDeps,
  session: Session,
  input: SaveConnectorRequest,
): Promise<void> {
  const workspaceId = session.workspaceId;
  const existing = await deps.db.workspaceConnector.findUnique({ where: { workspaceId } });
  await validate(deps, input, existing === null);
  if (existing && existing.version !== input.version) throw CONFLICT();
  const secrets = encryptedFields(deps, workspaceId, input);
  const plain = {
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    signInUrl: input.signInUrl ?? null,
    timeoutMs: input.timeoutMs ?? existing?.timeoutMs ?? 3000,
    cacheSeconds: input.cacheSeconds ?? existing?.cacheSeconds ?? 60,
    updatedById: session.userId,
  };
  await deps.db.$transaction(async (tx) => {
    // Prisma validates both branches of an upsert, and the create branch needs the secrets.
    const res = existing
      ? await tx.workspaceConnector.update({
          where: { workspaceId },
          data: { ...plain, ...secrets, version: { increment: 1 } },
        })
      : await tx.workspaceConnector.create({
          data: {
            ...(secrets as Omit<Prisma.WorkspaceConnectorUncheckedCreateInput, 'workspaceId'>),
            ...plain,
            workspaceId,
          },
        });
    await audit(tx, session, {
      id: res.id,
      action: existing ? 'connector.updated' : 'connector.created',
      after: { baseUrl: plain.baseUrl, secretsChanged: Object.keys(secrets).length > 0 },
    });
  });
}

function audit(
  tx: Prisma.TransactionClient,
  session: Session,
  e: { id: string; action: string; after: Prisma.InputJsonObject },
) {
  return tx.auditEvent.create({
    data: {
      workspaceId: session.workspaceId,
      actorId: session.userId,
      entityType: 'workspace_connector',
      entityId: e.id,
      action: e.action,
      after: e.after,
    },
  });
}
