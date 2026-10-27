import type { AiStatus } from '@bookleaf/shared';
import { KeyRound, PlugZap, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Select } from '../../components/atoms/Input';
import { Pill } from '../../components/atoms/Pill';
import { Field } from '../../components/molecules/Field';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { api, errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { keys, saveAiSettings, useAiStatus, useApiMutation } from '../../lib/queries';

type Form = Pick<
  AiStatus['settings'],
  'provider' | 'triageModel' | 'draftModel' | 'simulateOutage'
>;

function SettingsForm({ status }: { status: AiStatus }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(status.settings);
  const provider = status.providers.find((p) => p.id === form.provider);
  const save = useApiMutation(
    (f: Form) => saveAiSettings({ ...f, version: status.settings.version }),
    [keys.aiStatus],
  );
  const test = useApiMutation(
    () => api<{ ok: boolean; detail: string }>('/admin/ai/test', { method: 'POST' }),
    [keys.aiStatus],
  );
  const onSave = () =>
    save.mutate(form, {
      onSuccess: () => toast('success', 'AI settings saved'),
      onError: (e) => toast('error', errorMessage(e)),
    });
  const onTest = () =>
    test.mutate(undefined, {
      onSuccess: (r) => toast(r.ok ? 'success' : 'error', r.detail),
      onError: (e) => toast('error', errorMessage(e)),
    });
  const modelOptions = provider?.models.map((m) => (
    <option key={m.id} value={m.id}>
      {m.label} · {m.tier}
    </option>
  ));
  return (
    <Card className="flex max-w-[640px] flex-col gap-5 p-6">
      <Field
        id="provider"
        label="Provider"
        hint="Only providers with an API key configured on the server can be selected."
      >
        <Select
          id="provider"
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
        >
          {status.providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.configured}>
              {p.label}
              {p.configured ? '' : ' (no key configured)'}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="triage"
        label="Classification model"
        hint="Runs once per ticket: a fast, low-cost model is enough."
      >
        <Select
          id="triage"
          value={form.triageModel}
          onChange={(e) => setForm({ ...form, triageModel: e.target.value })}
        >
          {modelOptions}
        </Select>
      </Field>
      <Field
        id="draft"
        label="Draft model"
        hint="Writes the author-facing reply: a stronger model gives better prose."
      >
        <Select
          id="draft"
          value={form.draftModel}
          onChange={(e) => setForm({ ...form, draftModel: e.target.value })}
        >
          {modelOptions}
        </Select>
      </Field>
      <label className="flex items-start gap-3 rounded-[9px] border border-line bg-inset p-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.simulateOutage}
          onChange={(e) => setForm({ ...form, simulateOutage: e.target.checked })}
        />
        <span>
          <span className="block text-[13px] font-semibold">Simulate an AI outage</span>
          <span className="block text-[12px] text-ink-3">
            New tickets use rule-based classification and template drafts. Use it to demo graceful
            degradation.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-ink-3">
          {status.lastTest
            ? `Last test ${dateTime(status.lastTest.at)}: ${status.lastTest.detail}`
            : 'Not tested since the server started.'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onTest}
            isLoading={test.isPending}
            icon={<PlugZap size={14} aria-hidden />}
          >
            Test connection
          </Button>
          <Button onClick={onSave} isLoading={save.isPending} icon={<Save size={14} aria-hidden />}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AiSettingsPage() {
  const status = useAiStatus();
  return (
    <>
      <PageHeader
        title="AI Settings"
        subtitle="Choose which models classify tickets and draft replies. Changes apply to the next AI job."
      />
      <p className="mb-4 flex items-center gap-2 text-[12.5px] text-ink-2">
        <KeyRound size={14} aria-hidden /> API keys live in server environment variables and are
        never sent to the browser.
        {status.data?.settings.simulateOutage ? (
          <Pill tone="warning">Outage simulation on</Pill>
        ) : null}
      </p>
      {status.isPending ? <LoadingState /> : null}
      {status.isError ? (
        <ErrorState message={errorMessage(status.error)} onRetry={() => void status.refetch()} />
      ) : null}
      {/* Re-mount the form when saved settings change, so it never shows stale values. */}
      {status.data ? (
        <SettingsForm key={status.data.settings.version} status={status.data} />
      ) : null}
    </>
  );
}
