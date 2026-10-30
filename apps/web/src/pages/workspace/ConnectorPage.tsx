import type { Connector } from '@bookleaf/shared';
import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Input } from '../../components/atoms/Input';
import { Pill } from '../../components/atoms/Pill';
import { Field } from '../../components/molecules/Field';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { SecretField } from '../../components/organisms/SecretField';
import { TestConnection } from '../../components/organisms/TestConnection';
import { errorMessage, isApiError } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { saveConnector, useConnector, workspaceKeys } from '../../lib/workspace';

interface Form {
  baseUrl: string;
  signInUrl: string;
  apiKey: string;
  signingSecret: string;
  timeoutMs: string;
  cacheSeconds: string;
}

const formOf = (c: Connector): Form => ({
  baseUrl: c.baseUrl ?? '',
  signInUrl: c.signInUrl ?? '',
  apiKey: '',
  signingSecret: '',
  timeoutMs: String(c.timeoutMs),
  cacheSeconds: String(c.cacheSeconds),
});

function ConnectorForm({ connector }: { connector: Connector }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => formOf(connector));
  const save = useApiMutation(saveConnector, [workspaceKeys.connector]);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        version: connector.version,
        baseUrl: form.baseUrl,
        signInUrl: form.signInUrl || null,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        ...(form.signingSecret ? { signingSecret: form.signingSecret } : {}),
        timeoutMs: Number(form.timeoutMs),
        cacheSeconds: Number(form.cacheSeconds),
      },
      {
        onSuccess: (saved) => {
          toast('success', 'Product connection saved');
          setForm(formOf(saved));
        },
        onError: (err) => toast('error', errorMessage(err)),
      },
    );
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold">Your product’s customer endpoint</p>
          <Pill tone={connector.source === 'WORKSPACE' ? 'success' : 'neutral'} dot>
            {connector.source === 'WORKSPACE'
              ? 'Configured here'
              : connector.source === 'ENV'
                ? 'From server settings'
                : 'Not configured'}
          </Pill>
        </div>
        <Field
          id="baseUrl"
          label="Base URL"
          hint="We call {base URL}/support/customers/{id}. https only in production."
          error={fieldError('baseUrl')}
        >
          <Input
            id="baseUrl"
            value={form.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://app.example.com"
          />
        </Field>
        <Field
          id="signInUrl"
          label="Where customers sign in to your product"
          hint="Shown on the support sign-in page when a customer has no session."
          error={fieldError('signInUrl')}
        >
          <Input
            id="signInUrl"
            value={form.signInUrl}
            onChange={(e) => set({ signInUrl: e.target.value })}
          />
        </Field>
        <SecretField
          id="apiKey"
          label="API key we send as Bearer"
          stored={connector.apiKey}
          value={form.apiKey}
          onChange={(apiKey) => set({ apiKey })}
          error={fieldError('apiKey')}
          hint="At least 24 characters. Your product checks it on every request."
        />
        <SecretField
          id="signingSecret"
          label="Signing secret for sign-in tokens (HS256)"
          stored={connector.signingSecret}
          value={form.signingSecret}
          onChange={(signingSecret) => set({ signingSecret })}
          error={fieldError('signingSecret')}
          hint="At least 32 characters. Your product signs the hand-over token with it."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field id="timeoutMs" label="Timeout (ms)" error={fieldError('timeoutMs')}>
            <Input
              id="timeoutMs"
              type="number"
              min={200}
              max={10000}
              value={form.timeoutMs}
              onChange={(e) => set({ timeoutMs: e.target.value })}
            />
          </Field>
          <Field
            id="cacheSeconds"
            label="Reuse an answer for (seconds)"
            error={fieldError('cacheSeconds')}
          >
            <Input
              id="cacheSeconds"
              type="number"
              min={0}
              max={600}
              value={form.cacheSeconds}
              onChange={(e) => set({ cacheSeconds: e.target.value })}
            />
          </Field>
        </div>
        <div>
          <Button type="submit" isLoading={save.isPending} icon={<Save size={15} aria-hidden />}>
            Save connection
          </Button>
        </div>
      </Card>
    </form>
  );
}

export function ConnectorPage() {
  const connector = useConnector();
  return (
    <>
      <PageHeader
        title="Product connection"
        subtitle="How support reads your customers’ records. Secrets are encrypted and never shown again."
      />
      {connector.isPending ? <LoadingState /> : null}
      {connector.isError ? (
        <ErrorState error={connector.error} onRetry={() => void connector.refetch()} />
      ) : null}
      {connector.data ? (
        <div className="grid max-w-[880px] gap-4">
          <ConnectorForm key={connector.data.version} connector={connector.data} />
          <TestConnection connector={connector.data} />
        </div>
      ) : null}
    </>
  );
}
