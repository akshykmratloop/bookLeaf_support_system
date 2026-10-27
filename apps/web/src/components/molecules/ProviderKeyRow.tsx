import { useState } from 'react';
import type { ProviderCapability, ProviderKey } from '@bookleaf/shared';
import { Button } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  capability: ProviderCapability;
  label: string;
  saved: ProviderKey | undefined;
  providers: readonly string[];
  disabled: boolean;
  error?: string;
  onSave: (provider: string, apiKey: string) => void;
  onRemove: () => void;
}

/** One key slot: write-only. The saved key shows only as its last four characters. */
export function ProviderKeyRow(p: Props) {
  const [provider, setProvider] = useState(p.saved?.provider ?? p.providers[0] ?? '');
  const [apiKey, setApiKey] = useState('');
  const id = `key-${p.capability}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold">{p.label}</p>
        <p className="text-[12px] text-ink-2">
          {p.saved ? `Own key ····${p.saved.last4} (${p.saved.provider})` : "Platform's key"}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
        <Field id={`${id}-provider`} label="Provider">
          <Select
            id={`${id}-provider`}
            value={provider}
            disabled={p.disabled}
            onChange={(e) => setProvider(e.target.value)}
          >
            {p.providers.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id} label={p.saved ? 'Replace key' : 'API key'} error={p.error}>
          <Input
            id={id}
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled={p.disabled}
            placeholder="Paste the key; it is never shown again"
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2">
          <Button
            disabled={p.disabled || apiKey.trim().length === 0}
            onClick={() => {
              p.onSave(provider, apiKey.trim());
              setApiKey('');
            }}
          >
            Save
          </Button>
          {p.saved ? (
            <Button variant="secondary" disabled={p.disabled} onClick={p.onRemove}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
