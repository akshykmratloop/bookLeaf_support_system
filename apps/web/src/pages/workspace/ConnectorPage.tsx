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
import { DataSourcesEditor } from '../../components/organisms/DataSourcesEditor';
import { SecretField } from '../../components/organisms/SecretField';
import { TestConnection } from '../../components/organisms/TestConnection';
import { errorMessage, isApiError } from '../../lib/api';
import { sourceDraftsOf, toSourceInputs, type SourceDraft } from '../../lib/dataSources';
import { useApiMutation } from '../../lib/queries';
import { saveConnector, useConnector, workspaceKeys } from '../../lib/workspace';

interface Form {
  sources: SourceDraft[];
  signInUrl: string;
  apiKey: string;
  signingSecret: string;
}

const formOf = (c: Connector): Form => ({
  sources: sourceDraftsOf(c.sources),
  signInUrl: c.signInUrl ?? '',
  apiKey: '',
  signingSecret: '',
});

function ConnectorForm({ connector }: { connector: Connector }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => formOf(connector));
  const save = useApiMutation(saveConnector, [workspaceKeys.connector]);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  const listError = isApiError(save.error)
    ? save.error.problem.errors?.find((e) => e.path === 'sources')?.message
    : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        version: connector.version,
        sources: toSourceInputs(form.sources),
        signInUrl: form.signInUrl || null,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        ...(form.signingSecret ? { signingSecret: form.signingSecret } : {}),
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
          <p className="text-[15px] font-semibold">Your product’s customer data</p>
          <Pill tone={connector.source === 'WORKSPACE' ? 'success' : 'neutral'} dot>
            {connector.source === 'WORKSPACE'
              ? 'Configured here'
              : connector.source === 'ENV'
                ? 'From server settings'
                : 'Not configured'}
          </Pill>
        </div>
        <DataSourcesEditor
          drafts={form.sources}
          onChange={(sources) => set({ sources })}
          fieldError={fieldError}
          listError={listError}
        />
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
          label="API key we send to every source"
          stored={connector.apiKey}
          value={form.apiKey}
          onChange={(apiKey) => set({ apiKey })}
          error={fieldError('apiKey')}
          hint="At least 24 characters. Sent as Bearer, or in the key header a source names."
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
