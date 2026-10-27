import type { ProviderCapability } from '@bookleaf/shared';
import { errorMessage, isApiError } from '../../lib/api';
import {
  providerKeysKey,
  removeProviderKey,
  saveProviderKey,
  useProviderKeys,
} from '../../lib/providerKeys';
import { useApiMutation } from '../../lib/queries';
import { ProviderKeyRow } from '../molecules/ProviderKeyRow';
import { useToast } from '../molecules/Toast';
import { Section } from './WorkspaceSettingsSections';

const SLOTS: { capability: ProviderCapability; label: string }[] = [
  { capability: 'AI', label: 'AI (chat, triage, reply drafts)' },
  { capability: 'VOICE', label: 'Voice calls' },
];

/** Bring your own key: the workspace pays its own provider instead of using the platform's. */
export function ProviderKeysSection() {
  const toast = useToast();
  const keys = useProviderKeys();
  const save = useApiMutation(saveProviderKey, [providerKeysKey]);
  const remove = useApiMutation(removeProviderKey, [providerKeysKey]);
  const done = (message: string) => ({
    onSuccess: () => toast('success', message),
    onError: (e: unknown) => toast('error', errorMessage(e)),
  });
  const data = keys.data;
  return (
    <Section
      title="Provider keys"
      description="Use your own AI and voice provider accounts. Keys are stored encrypted and never shown again; without one, the platform's key is used."
    >
      {data && !data.secretsConfigured ? (
        <p className="text-[12.5px] text-ink-2">
          This server has no master key for secrets, so keys cannot be saved yet.
        </p>
      ) : null}
      {data
        ? SLOTS.map((slot) => (
            <ProviderKeyRow
              key={slot.capability}
              {...slot}
              saved={data.items.find((k) => k.capability === slot.capability)}
              providers={data.providers[slot.capability]}
              disabled={!data.secretsConfigured || save.isPending || remove.isPending}
              error={
                isApiError(save.error) && save.variables?.capability === slot.capability
                  ? save.error.fieldError('apiKey')
                  : undefined
              }
              onSave={(provider, apiKey) =>
                save.mutate({ capability: slot.capability, provider, apiKey }, done('Key saved'))
              }
              onRemove={() => remove.mutate(slot.capability, done('Key removed'))}
            />
          ))
        : null}
    </Section>
  );
}
