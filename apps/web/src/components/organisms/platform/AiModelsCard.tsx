import type { PlatformAiStatus, UpdatePlatformAiSettings } from '@bookleaf/shared';
import { useState } from 'react';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Dropdown } from '../../molecules/Dropdown';
import { Field } from '../../molecules/Field';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, savePlatformAi } from '../../../lib/platform';
import { modelOptions, providerOptions, voiceModelOptions } from '../../../lib/platformAiOptions';
import { useApiMutation } from '../../../lib/queries';

type Task = 'triageModel' | 'draftModel' | 'chatModel';
const TASKS: { key: Task; label: string }[] = [
  { key: 'triageModel', label: 'Triage model' },
  { key: 'draftModel', label: 'Draft model' },
  { key: 'chatModel', label: 'Chat model' },
];

/** The provider and models every customer's AI uses (U-7: platform-only, never per customer). */
export function AiModelsCard({ status }: { status: PlatformAiStatus }) {
  const toast = useToast();
  const s = status.settings;
  const [form, setForm] = useState({
    provider: s.provider,
    triageModel: s.triageModel,
    draftModel: s.draftModel,
    chatModel: s.chatModel,
    voiceModel: s.voiceModel ?? '',
  });
  const save = useApiMutation(savePlatformAi, [platformKeys.ai]);
  const aiProviders = status.providers.filter((p) => p.capability === 'AI');
  const models = aiProviders.find((p) => p.id === form.provider)?.models ?? [];
  const voiceModels = status.providers.find((p) => p.capability === 'VOICE')?.models ?? [];
  const pickProvider = (provider: string) => {
    const first = aiProviders.find((p) => p.id === provider)?.models[0]?.id ?? '';
    setForm((f) => ({ ...f, provider, triageModel: first, draftModel: first, chatModel: first }));
  };
  const submit = () => {
    const input: UpdatePlatformAiSettings = {
      version: s.version,
      provider: form.provider,
      triageModel: form.triageModel,
      draftModel: form.draftModel,
      chatModel: form.chatModel,
      voiceModel: form.voiceModel.trim() === '' ? null : form.voiceModel.trim(),
    };
    save.mutate(input, {
      onSuccess: () => toast('success', 'AI settings saved'),
      onError: (err) => toast('error', errorMessage(err)),
    });
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Provider and models</h2>
        <p className="text-[12.5px] text-ink-2">
          Used for every customer. Customers cannot change these.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pf-provider" label="AI provider">
          <Dropdown
            id="pf-provider"
            value={form.provider}
            options={providerOptions(aiProviders, s.provider)}
            onChange={pickProvider}
          />
        </Field>
        {TASKS.map((t) => (
          <Field key={t.key} id={`pf-${t.key}`} label={t.label}>
            <Dropdown
              id={`pf-${t.key}`}
              value={form[t.key]}
              options={modelOptions(models)}
              onChange={(v) => setForm((f) => ({ ...f, [t.key]: v }))}
            />
          </Field>
        ))}
        <Field
          id="pf-voiceModel"
          label="Voice model"
          hint={`Server default: ${status.defaultVoiceModel}`}
        >
          <Dropdown
            id="pf-voiceModel"
            value={form.voiceModel}
            options={voiceModelOptions(voiceModels, status.defaultVoiceModel, form.voiceModel)}
            onChange={(v) => setForm((f) => ({ ...f, voiceModel: v }))}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} isLoading={save.isPending}>
          Save models
        </Button>
      </div>
    </Card>
  );
}
