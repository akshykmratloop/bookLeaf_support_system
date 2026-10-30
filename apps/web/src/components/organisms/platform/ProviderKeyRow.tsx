import type { PlatformProvider } from '@bookleaf/shared';
import { useState } from 'react';
import { Button } from '../../atoms/Button';
import { Pill } from '../../atoms/Pill';
import { SecretField } from '../SecretField';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, removePlatformKey, savePlatformKey } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

const SOURCE = {
  SAVED: { tone: 'success', text: 'Saved here' },
  ENV: { tone: 'info', text: 'From server env' },
  NONE: { tone: 'warning', text: 'No key' },
} as const;

/** One provider's key: where it comes from, and save / remove a key kept encrypted here. */
export function ProviderKeyRow({ p, canSave }: { p: PlatformProvider; canSave: boolean }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const save = useApiMutation(savePlatformKey, [platformKeys.ai]);
  const remove = useApiMutation(removePlatformKey, [platformKeys.ai]);
  const id = `key-${p.capability}-${p.id}`;
  const fail = (err: unknown) => toast('error', errorMessage(err));
  const onSave = () =>
    save.mutate(
      { capability: p.capability, provider: p.id, apiKey: value.trim() },
      { onSuccess: () => (setValue(''), toast('success', `${p.label} key saved`)), onError: fail },
    );
  const onRemove = () =>
    remove.mutate(
      { capability: p.capability, provider: p.id },
      { onSuccess: () => toast('success', `${p.label} key removed`), onError: fail },
    );
  const source = SOURCE[p.keySource];
  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-semibold">{p.label}</p>
        <Pill tone={source.tone} dot>
          {source.text}
        </Pill>
      </div>
      <SecretField
        id={id}
        label={`${p.label} API key`}
        stored={p.last4 ? { hint: `…${p.last4}`, updatedAt: new Date(0).toISOString() } : null}
        value={value}
        onChange={setValue}
        hint={p.keySource === 'ENV' ? 'A key saved here replaces the env key.' : undefined}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {p.keySource === 'SAVED' ? (
          <Button variant="ghost" size="sm" onClick={onRemove} isLoading={remove.isPending}>
            Remove saved key
          </Button>
        ) : null}
        <Button
          size="sm"
          onClick={onSave}
          isLoading={save.isPending}
          disabled={!canSave || value.trim().length === 0}
        >
          Save key
        </Button>
      </div>
    </li>
  );
}
