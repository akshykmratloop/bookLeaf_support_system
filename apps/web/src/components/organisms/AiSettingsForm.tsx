import type { AiStatus } from '@bookleaf/shared';
import { PlugZap, Save } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { keys, saveAiSettings, useApiMutation } from '../../lib/queries';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Dropdown, type DropdownOption } from '../molecules/Dropdown';
import { Field } from '../molecules/Field';
import { useToast } from '../molecules/Toast';

type Form = Pick<
  AiStatus['settings'],
  'provider' | 'triageModel' | 'draftModel' | 'simulateOutage'
>;

interface SelectFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
}

function SelectField({ id, label, hint, ...dropdown }: SelectFieldProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Dropdown id={id} aria-describedby={`${id}-hint`} {...dropdown} />
    </Field>
  );
}

const NO_KEY_REASON = 'No API key configured';

const providerOptions = (status: AiStatus): DropdownOption[] =>
  status.providers.map((p) => ({
    value: p.id,
    label: p.label,
    disabled: !p.configured,
    disabledReason: NO_KEY_REASON,
  }));

function OutageToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-control border border-line bg-inset p-3">
      <input
        id="simulateOutage"
        name="simulateOutage"
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[13px] font-semibold">Simulate an AI outage</span>
        <span className="block text-[12px] text-ink-3">
          New tickets use rule-based classification and template drafts. Use it to demo graceful
          degradation.
        </span>
      </span>
    </label>
  );
}

/** Save and test, each with a toast for the result. */
function useSettingsActions(version: number) {
  const toast = useToast();
  const save = useApiMutation((f: Form) => saveAiSettings({ ...f, version }), [keys.aiStatus]);
  const test = useApiMutation(
    () => api<{ ok: boolean; detail: string }>('/admin/ai/test', { method: 'POST' }),
    [keys.aiStatus],
  );
  const onError = (e: unknown) => toast('error', errorMessage(e));
  return {
    onSave: (form: Form) =>
      save.mutate(form, { onSuccess: () => toast('success', 'AI settings saved'), onError }),
    onTest: () =>
      test.mutate(undefined, {
        onSuccess: (r) => toast(r.ok ? 'success' : 'error', r.detail),
        onError,
      }),
    isSaving: save.isPending,
    isTesting: test.isPending,
  };
}

const lastTestText = (status: AiStatus) =>
  status.lastTest
    ? `Last test ${dateTime(status.lastTest.at)}: ${status.lastTest.detail}`
    : 'Not tested since the server started.';

export function AiSettingsForm({ status }: { status: AiStatus }) {
  const [form, setForm] = useState<Form>(status.settings);
  const actions = useSettingsActions(status.settings.version);
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const provider = status.providers.find((p) => p.id === form.provider);
  const modelOptions = (provider?.models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
    hint: m.tier,
  }));
  return (
    <Card className="flex max-w-[640px] flex-col gap-5 p-6">
      <SelectField
        id="provider"
        label="Provider"
        hint="Only providers with an API key configured on the server can be selected."
        value={form.provider}
        options={providerOptions(status)}
        onChange={(provider) => set({ provider })}
      />
      <SelectField
        id="triage"
        label="Classification model"
        hint="Runs once per ticket: a fast, low-cost model is enough."
        value={form.triageModel}
        options={modelOptions}
        onChange={(triageModel) => set({ triageModel })}
      />
      <SelectField
        id="draft"
        label="Draft model"
        hint="Writes the author-facing reply: a stronger model gives better prose."
        value={form.draftModel}
        options={modelOptions}
        onChange={(draftModel) => set({ draftModel })}
      />
      <OutageToggle
        checked={form.simulateOutage}
        onChange={(simulateOutage) => set({ simulateOutage })}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-ink-3">{lastTestText(status)}</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={actions.onTest}
            isLoading={actions.isTesting}
            icon={<PlugZap size={14} aria-hidden />}
          >
            Test connection
          </Button>
          <Button
            onClick={() => actions.onSave(form)}
            isLoading={actions.isSaving}
            icon={<Save size={14} aria-hidden />}
          >
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
