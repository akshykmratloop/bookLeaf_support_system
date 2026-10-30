import type { OnboardingStatus, OnboardingStep } from '@bookleaf/shared';
import { Rocket } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/molecules/PageHeader';
import { SetupCompleteCard } from '../../components/molecules/SetupCompleteCard';
import { SetupProgress } from '../../components/molecules/SetupProgress';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { SetupStepCard } from '../../components/organisms/SetupStepCard';
import { TestTicketActions } from '../../components/organisms/TestTicketActions';
import { progressOf, useOnboarding } from '../../lib/onboarding';
import { signInSample, STEP_COPY, widgetSample } from '../../lib/onboardingSteps';

function sampleFor(step: OnboardingStep, s: OnboardingStatus) {
  const kind = STEP_COPY[step.id].sample;
  if (kind === 'signIn') return { label: 'Sign-in endpoint', code: signInSample(s.workspace.slug) };
  if (kind === 'widget')
    return { label: 'Widget script tag', code: widgetSample(s.supportUrl, s.workspace.slug) };
  return undefined;
}

function Steps({ status }: { status: OnboardingStatus }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Setup steps">
      {status.steps.map((step, i) => (
        <SetupStepCard
          key={step.id}
          number={i + 1}
          step={step}
          copy={STEP_COPY[step.id]}
          docsUrl={status.docsUrl}
          sample={sampleFor(step, status)}
        >
          {step.id === 'test' ? (
            <TestTicketActions
              supportUrl={status.supportUrl}
              slug={status.workspace.slug}
              last={status.testTicket}
            />
          ) : null}
        </SetupStepCard>
      ))}
    </ol>
  );
}

function Guide({ status }: { status: OnboardingStatus }) {
  const progress = progressOf(status.steps);
  const [showSteps, setShowSteps] = useState(false);
  if (progress.complete && !showSteps)
    return (
      <SetupCompleteCard
        done={progress.done}
        total={progress.total}
        onShowSteps={() => setShowSteps(true)}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <SetupProgress progress={progress} />
      <Steps status={status} />
    </div>
  );
}

/** "Get started" (U-12): a checklist that ticks itself from real checks on the server. */
export function GetStartedPage() {
  const status = useOnboarding();
  return (
    <div className="max-w-[880px] min-w-0">
      <PageHeader
        title="Get started"
        subtitle="Connect support to your product. Each step ticks by itself when support sees it working."
        actions={<Rocket size={18} aria-hidden className="text-ink-3" />}
      />
      {status.isPending ? <LoadingState /> : null}
      {status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : null}
      {status.data ? <Guide status={status.data} /> : null}
    </div>
  );
}
