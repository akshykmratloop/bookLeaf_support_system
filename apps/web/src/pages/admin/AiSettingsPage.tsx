import { KeyRound } from 'lucide-react';
import { Pill } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { AiSettingsForm } from '../../components/organisms/AiSettingsForm';
import { useAiStatus } from '../../lib/queries';

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
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : null}
      {/* Re-mount the form when saved settings change, so it never shows stale values. */}
      {status.data ? (
        <AiSettingsForm key={status.data.settings.version} status={status.data} />
      ) : null}
    </>
  );
}
