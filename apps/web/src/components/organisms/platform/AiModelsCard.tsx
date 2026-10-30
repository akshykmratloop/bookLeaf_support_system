import type { PlatformAiStatus, UpdatePlatformAiSettings } from '@bookleaf/shared';
import { useState } from 'react';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Input, Select } from '../../atoms/Input';
import { Field } from '../../molecules/Field';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, savePlatformAi } from '../../../lib/platform';
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
          <Select
            id="pf-provider"
            value={form.provider}
            onChange={(e) => pickProvider(e.target.value)}
          >
            {aiProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {TASKS.map((t) => (
          <Field key={t.key} id={`pf-${t.key}`} label={t.label}>
            <Select
              id={`pf-${t.key}`}
              value={form[t.key]}
              onChange={(e) => setForm((f) => ({ ...f, [t.key]: e.target.value }))}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.tier}
                </option>
              ))}
            </Select>
          </Field>
        ))}
        <Field
          id="pf-voiceModel"
          label="Voice model"
          hint={`Empty uses the server default: ${status.defaultVoiceModel}`}
        >
          <Input
            id="pf-voiceModel"
            value={form.voiceModel}
            placeholder={status.defaultVoiceModel}
            spellCheck={false}
            aria-describedby="pf-voiceModel-hint"
            onChange={(e) => setForm((f) => ({ ...f, voiceModel: e.target.value }))}
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
