import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { AiModelsCard } from '../../components/organisms/platform/AiModelsCard';
import { AiTestCard } from '../../components/organisms/platform/AiTestCard';
import { OutageCard } from '../../components/organisms/platform/OutageCard';
import { ProviderKeysCard } from '../../components/organisms/platform/ProviderKeysCard';
import { usePlatformAi } from '../../lib/platform';

/** /platform/ai — providers, keys, models and the global outage switch for every customer. */
export function PlatformAiPage() {
  const ai = usePlatformAi();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI and keys"
        subtitle="One provider setup for every customer. Customers see “Managed by your support provider”."
      />
      {ai.isPending ? <LoadingState label="Loading AI settings…" /> : null}
      {ai.isError ? <ErrorState error={ai.error} onRetry={() => void ai.refetch()} /> : null}
      {ai.data ? (
        <>
          <OutageCard settings={ai.data.settings} />
          <AiModelsCard key={ai.data.settings.version} status={ai.data} />
          <AiTestCard lastTest={ai.data.lastTest} />
          <ProviderKeysCard status={ai.data} />
        </>
      ) : null}
    </div>
  );
}
