import type { ApiKey } from '@bookleaf/shared';
import { ChevronRight } from 'lucide-react';
import { Card } from '../atoms/Card';
import { ApiKeyRow } from '../molecules/ApiKeyRow';
import { EmptyState } from '../molecules/States';
import { groupKeys } from '../../lib/apiKeys';

interface Props {
  keys: ApiKey[];
  revokingId: string | null;
  onRevoke: (k: ApiKey) => void;
}

/** Active keys first; revoked keys greyed in their own collapsed group (U-8). */
export function ApiKeyList({ keys, revokingId, onRevoke }: Props) {
  const { active, revoked } = groupKeys(keys);
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="active-keys" className="flex flex-col gap-2">
        <h2 id="active-keys" className="text-[14px] font-bold text-ink">
          Active keys <span className="font-normal text-ink-3">({active.length})</span>
        </h2>
        <Card className="p-0">
          {active.length === 0 ? (
            <EmptyState
              title="No active API keys"
              body="Your product uses a key to call the support API server-to-server."
            />
          ) : (
            <ul>
              {active.map((k) => (
                <ApiKeyRow
                  key={k.id}
                  k={k}
                  isRevoking={revokingId === k.id}
                  onRevoke={() => onRevoke(k)}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>
      {revoked.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-control text-[13px] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight
              size={15}
              aria-hidden
              className="transition-transform group-open:rotate-90"
            />
            Revoked keys ({revoked.length})
          </summary>
          <Card variant="flat" className="mt-2 p-0">
            <ul>
              {revoked.map((k) => (
                <ApiKeyRow key={k.id} k={k} />
              ))}
            </ul>
          </Card>
        </details>
      ) : null}
    </div>
  );
}
