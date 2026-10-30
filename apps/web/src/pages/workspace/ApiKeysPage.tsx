import { scopeLabel, type ApiKey, type CreatedApiKey } from '@bookleaf/shared';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { CopyButton } from '../../components/molecules/CopyButton';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { ApiKeyCreateForm } from '../../components/organisms/ApiKeyCreateForm';
import { ApiKeyList } from '../../components/organisms/ApiKeyList';
import { errorMessage } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { createApiKey, revokeApiKey, useApiKeys, workspaceKeys } from '../../lib/workspace';

function NewKey({ created, onDone }: { created: CreatedApiKey; onDone: () => void }) {
  return (
    <Card className="flex flex-col gap-3 border-brand p-4 sm:p-5" role="status">
      <p className="text-[15px] font-semibold text-ink">Copy your new key now</p>
      <p className="text-[12.5px] text-ink-2">
        “{created.key.name}” can: {created.key.scopes.map(scopeLabel).join(', ')}. This is the only
        time the key is shown. Store it in your product’s secret manager.
      </p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 rounded-control bg-inset p-3 font-mono text-[12.5px] break-all select-all">
          {created.plainKey}
        </code>
        <CopyButton value={created.plainKey} label="Copy the new API key" text="Copy key" />
      </div>
      <div>
        <Button variant="secondary" onClick={onDone}>
          I have copied it
        </Button>
      </div>
    </Card>
  );
}

function Keys({ keys }: { keys: ApiKey[] }) {
  const toast = useToast();
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const create = useApiMutation(createApiKey, [workspaceKeys.apiKeys]);
  const revoke = useApiMutation(revokeApiKey, [workspaceKeys.apiKeys]);
  const onError = (err: unknown) => toast('error', errorMessage(err));
  const onRevoke = (k: ApiKey) => {
    if (window.confirm(`Revoke “${k.name}”? Calls with it stop working at once.`))
      revoke.mutate(k.id, { onError });
  };
  return (
    <div className="grid max-w-[880px] min-w-0 gap-5">
      {created ? <NewKey created={created} onDone={() => setCreated(null)} /> : null}
      <ApiKeyCreateForm
        isPending={create.isPending}
        onCreate={(input, onCreated) =>
          create.mutate(input, {
            onSuccess: (result) => {
              setCreated(result);
              onCreated();
            },
            onError,
          })
        }
      />
      <ApiKeyList
        keys={keys}
        revokingId={revoke.isPending ? (revoke.variables ?? null) : null}
        onRevoke={onRevoke}
      />
    </div>
  );
}

export function ApiKeysPage() {
  const keys = useApiKeys();
  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Keys your product uses to call the support API. Each key does only what you allow; only a hash is stored and the key is shown once."
        actions={<KeyRound size={18} aria-hidden className="text-ink-3" />}
      />
      {keys.isPending ? <LoadingState /> : null}
      {keys.isError ? <ErrorState error={keys.error} onRetry={() => void keys.refetch()} /> : null}
      {keys.data ? <Keys keys={keys.data} /> : null}
    </>
  );
}
