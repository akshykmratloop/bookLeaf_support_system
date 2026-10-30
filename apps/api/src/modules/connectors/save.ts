import { MAX_DATA_SOURCES, type SaveConnectorRequest } from '@bookleaf/shared';
import type { Prisma, WorkspaceConnector } from '@prisma/client';
import { recordMappingOf } from '../../host/sources/mapping.js';
import { hintOf } from '../../platform/crypto/envelope.js';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { aadFor, type ConnectorDeps } from './deps.js';
import {
  applySources,
  changedList,
  checkSources,
  checkUrl,
  legacyBaseUrl,
  pruneMapping,
  requestedChange,
  type FieldError,
  type SourcesChange,
} from './save-sources.js';
import { SecretsNotConfiguredError } from './store.js';

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_CACHE_SECONDS = 60;

interface Existing {
  row: WorkspaceConnector | null;
  sources: { format: string }[];
}

/** Every source URL must be safe; the older form names its single URL `baseUrl`. */
async function sourceErrors(deps: ConnectorDeps, change: SourcesChange, existing: Existing) {
  const errors = (await checkSources(deps, changedList(change))).map((e) =>
    change.kind === 'contract' ? { ...e, path: 'baseUrl' } : e,
  );
  const addsContract =
    change.kind === 'contract' && !existing.sources.some((s) => s.format === 'CONTRACT');
  if (addsContract && existing.sources.length >= MAX_DATA_SOURCES)
    errors.push({ path: 'baseUrl', message: `At most ${MAX_DATA_SOURCES} data sources` });
  return errors;
}

/** The first save must bring both secrets and at least one source. */
function firstSaveErrors(input: SaveConnectorRequest, change: SourcesChange): FieldError[] {
  const required = (path: string, message = 'Required the first time') => ({ path, message });
  return [
    ...(change.kind === 'keep' ? [required('sources', 'Add at least one data source')] : []),
    ...(input.apiKey ? [] : [required('apiKey')]),
    ...(input.signingSecret ? [] : [required('signingSecret')]),
  ];
}

async function validate(
  deps: ConnectorDeps,
  input: SaveConnectorRequest,
  change: SourcesChange,
  existing: Existing,
) {
  const signIn = await checkUrl(deps, 'signInUrl', input.signInUrl);
  const errors: FieldError[] = [
    ...(signIn ? [signIn] : []),
    ...(await sourceErrors(deps, change, existing)),
    ...(existing.row === null ? firstSaveErrors(input, change) : []),
  ];
  if (errors.length) throw new ValidationError('Invalid product connection', errors);
}

function encryptedFields(deps: ConnectorDeps, workspaceId: string, input: SaveConnectorRequest) {
  const env = deps.envelope;
  if (!env) throw new SecretsNotConfiguredError();
  const field = (value: string | undefined, name: 'apiKey' | 'signingSecret') =>
    value
      ? {
          [`${name}Enc`]: env.encrypt(value, aadFor(workspaceId, name)),
          [`${name}Hint`]: hintOf(value),
        }
      : {};
  return {
    ...field(input.apiKey, 'apiKey'),
    ...field(input.signingSecret, 'signingSecret'),
  } as Partial<
    Pick<
      Prisma.WorkspaceConnectorUncheckedCreateInput,
      'apiKeyEnc' | 'apiKeyHint' | 'signingSecretEnc' | 'signingSecretHint'
    >
  >;
}

const CONFLICT = () =>
  new ConflictError(
    'VERSION_CONFLICT',
    'The product connection was changed by someone else. Reload and try again.',
  );

function plainFields(
  input: SaveConnectorRequest,
  change: SourcesChange,
  session: Session,
  row: WorkspaceConnector | null,
) {
  const list = changedList(change);
  const was = row ?? {
    baseUrl: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheSeconds: DEFAULT_CACHE_SECONDS,
  };
  const baseUrl = list.length ? { baseUrl: legacyBaseUrl(list) ?? was.baseUrl } : {};
  return {
    ...baseUrl,
    signInUrl: input.signInUrl ?? null,
    timeoutMs: input.timeoutMs ?? was.timeoutMs,
    cacheSeconds: input.cacheSeconds ?? was.cacheSeconds,
    updatedById: session.userId,
  };
}

async function writeConnector(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  row: WorkspaceConnector | null,
  data: ReturnType<typeof plainFields> & ReturnType<typeof encryptedFields>,
) {
  if (row)
    return tx.workspaceConnector.update({
      where: { workspaceId },
      data: { ...data, version: { increment: 1 } },
    });
  // Prisma validates both branches of an upsert, and the create branch needs the secrets.
  return tx.workspaceConnector.create({
    data: { ...(data as Prisma.WorkspaceConnectorUncheckedCreateInput), workspaceId },
  });
}

/**
 * Creates or updates the workspace's connector and its data sources (U-9). Secrets arrive once,
 * are encrypted at rest and never returned. Stale versions conflict. One transaction, audited.
 */
export async function saveConnector(
  deps: ConnectorDeps,
  session: Session,
  input: SaveConnectorRequest,
): Promise<void> {
  const workspaceId = session.workspaceId;
  const [row, sources] = await Promise.all([
    deps.db.workspaceConnector.findUnique({ where: { workspaceId } }),
    deps.db.workspaceDataSource.findMany({ where: { workspaceId }, select: { format: true } }),
  ]);
  const change = requestedChange(input);
  await validate(deps, input, change, { row, sources });
  if (row && row.version !== input.version) throw CONFLICT();
  const secrets = encryptedFields(deps, workspaceId, input);
  const plain = plainFields(input, change, session, row);
  await deps.db.$transaction(async (tx) => {
    const saved = await writeConnector(tx, workspaceId, row, { ...plain, ...secrets });
    const kept = await applySources(tx, workspaceId, change);
    if (kept && saved.recordMapping !== null) {
      const recordMapping = pruneMapping(recordMappingOf(saved.recordMapping), kept);
      await tx.workspaceConnector.update({ where: { workspaceId }, data: { recordMapping } });
    }
    await audit(tx, session, {
      id: saved.id,
      action: row ? 'connector.updated' : 'connector.created',
      after: {
        sources: changedList(change).map((s) => s.urlTemplate),
        secretsChanged: Object.keys(secrets).length > 0,
      },
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
