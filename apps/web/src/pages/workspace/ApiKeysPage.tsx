import { API_KEY_SCOPES, type ApiKey, type CreatedApiKey } from '@bookleaf/shared';
import { KeyRound, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Input } from '../../components/atoms/Input';
import { Pill } from '../../components/atoms/Pill';
import { Field } from '../../components/molecules/Field';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { errorMessage } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { createApiKey, revokeApiKey, useApiKeys, workspaceKeys } from '../../lib/workspace';

function KeyRow({ k, onRevoke }: { k: ApiKey; onRevoke: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold">
          {k.name}
          <code className="font-mono text-[12px] text-ink-3">{k.prefix}_…</code>
          {k.revokedAt ? <Pill tone="danger">revoked</Pill> : <Pill tone="success">active</Pill>}
        </p>
        <p className="text-[12.5px] text-ink-2">
          {k.scopes.join(', ')} · created {new Date(k.createdAt).toLocaleDateString()}
          {k.lastUsedAt
            ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
            : ' · never used'}
        </p>
      </div>
      {k.revokedAt ? null : (
        <Button variant="danger" size="sm" onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </li>
  );
}

function NewKey({ created, onDone }: { created: CreatedApiKey; onDone: () => void }) {
  return (
    <Card className="flex flex-col gap-3 border-brand p-5">
      <p className="text-[15px] font-semibold">Copy your new key now</p>
      <p className="text-[12.5px] text-ink-2">
        This is the only time it is shown. Store it in your product’s secret manager.
      </p>
      <code className="rounded-[9px] bg-inset p-3 font-mono text-[12.5px] break-all select-all">
        {created.plainKey}
      </code>
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
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const create = useApiMutation(createApiKey, [workspaceKeys.apiKeys]);
  const revoke = useApiMutation(revokeApiKey, [workspaceKeys.apiKeys]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, scopes: [...API_KEY_SCOPES] },
      {
        onSuccess: (result) => {
          setCreated(result);
          setName('');
        },
        onError: (err) => toast('error', errorMessage(err)),
      },
    );
  };
  return (
    <div className="grid max-w-[880px] gap-4">
      {created ? <NewKey created={created} onDone={() => setCreated(null)} /> : null}
      <form onSubmit={submit} className="flex items-end gap-2" noValidate>
        <div className="flex-1">
          <Field id="key-name" label="New key name" hint="e.g. Production server, Staging">
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button
          type="submit"
          icon={<Plus size={15} aria-hidden />}
          isLoading={create.isPending}
          disabled={!name.trim()}
        >
          Create key
        </Button>
      </form>
      <Card className="p-0">
        {keys.length === 0 ? (
          <EmptyState
            title="No API keys yet"
            body="Your product uses a key to call the support API server-to-server."
          />
        ) : (
          <ul>
            {keys.map((k) => (
              <KeyRow
                key={k.id}
                k={k}
                onRevoke={() => {
                  if (window.confirm(`Revoke ${k.name}? Calls with it will stop working.`))
                    revoke.mutate(k.id, { onError: (err) => toast('error', errorMessage(err)) });
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ApiKeysPage() {
  const keys = useApiKeys();
  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Keys your product uses to call the support API. Only a hash is stored; the key is shown once."
        actions={<KeyRound size={18} aria-hidden className="text-ink-3" />}
      />
      {keys.isPending ? <LoadingState /> : null}
      {keys.isError ? <ErrorState error={keys.error} onRetry={() => void keys.refetch()} /> : null}
      {keys.data ? <Keys keys={keys.data} /> : null}
    </>
  );
}
