import { scopeLabel, type ApiKey } from '@bookleaf/shared';
import { Button } from '../atoms/Button';
import { Pill } from '../atoms/Pill';
import { keyDates } from '../../lib/apiKeys';
import { CopyButton } from './CopyButton';

interface Props {
  k: ApiKey;
  /** Absent for a revoked key: it can no longer be used or changed. */
  onRevoke?: () => void;
  isRevoking?: boolean;
}

/** One key: name, status, readable permissions, dates, copyable prefix, Revoke (U-8). */
export function ApiKeyRow({ k, onRevoke, isRevoking = false }: Props) {
  const revoked = k.revokedAt !== null;
  const dates = keyDates(k);
  return (
    <li
      className={`flex flex-col gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 ${revoked ? 'text-ink-3' : ''}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p
            className={`min-w-0 truncate text-[13.5px] font-semibold ${revoked ? '' : 'text-ink'}`}
          >
            {k.name}
          </p>
          {revoked ? (
            <Pill tone="neutral">Revoked</Pill>
          ) : (
            <Pill tone="success" dot>
              Active
            </Pill>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Permissions">
          {k.scopes.map((s) => (
            <li
              key={s}
              title={s}
              className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11.5px] font-semibold text-ink-2"
            >
              {scopeLabel(s)}
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-ink-3">
          Created {dates.created} · {dates.used}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <code className="rounded-control bg-inset px-2 py-1 font-mono text-[12px] text-ink-2">
          {k.prefix}
        </code>
        <CopyButton value={k.prefix} label={`Copy prefix of ${k.name}`} />
        {onRevoke ? (
          <Button variant="danger" size="sm" onClick={onRevoke} isLoading={isRevoking}>
            Revoke
          </Button>
        ) : null}
      </div>
    </li>
  );
}
