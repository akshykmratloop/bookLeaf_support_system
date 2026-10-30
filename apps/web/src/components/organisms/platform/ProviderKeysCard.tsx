import type { PlatformAiStatus } from '@bookleaf/shared';
import { Card } from '../../atoms/Card';
import { ProviderKeyRow } from './ProviderKeyRow';

/** Every provider's key, encrypted at rest. Env keys stay the fallback when nothing is saved. */
export function ProviderKeysCard({ status }: { status: PlatformAiStatus }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Provider keys</h2>
      <p className="text-[12.5px] text-ink-2">
        Keys are encrypted and never shown again. With no saved key the server env key is used.
      </p>
      {status.secretsConfigured ? null : (
        <p
          role="status"
          className="mt-3 rounded-control bg-warning-bg px-3 py-2 text-[12.5px] text-warning"
        >
          Saving keys needs SECRETS_MASTER_KEY on the server. Env keys still work.
        </p>
      )}
      <ul className="mt-2" aria-label="Provider keys">
        {status.providers.map((p) => (
          <ProviderKeyRow
            key={`${p.capability}-${p.id}`}
            p={p}
            canSave={status.secretsConfigured}
          />
        ))}
      </ul>
    </Card>
  );
}
