import type { PlatformAiStatus } from '@bookleaf/shared';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Pill } from '../../atoms/Pill';
import { useToast } from '../../molecules/Toast';
import { testRunToast } from '../../../lib/aiTestRun';
import { errorMessage } from '../../../lib/api';
import { platformKeys, testPlatformAi } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

type RecentJobs = PlatformAiStatus['recentJobs'];
type LastTest = PlatformAiStatus['lastTest'];

/** Jobs that ended without AI lately: an expired key shows here, not only in the logs. */
function RecentOutcomes({ jobs }: { jobs: RecentJobs }) {
  const withoutAi = jobs.fallback + jobs.failed;
  if (withoutAi === 0)
    return (
      <p className="mt-1 text-[12.5px] text-ink-3">
        Every AI job in the last {jobs.windowMinutes} minutes used AI.
      </p>
    );
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      <Pill tone={jobs.authOrNotConfigured > 0 ? 'danger' : 'warning'} dot>
        {withoutAi} without AI in the last {jobs.windowMinutes} min
      </Pill>
      <span>
        {jobs.fallback} fell back to rules, {jobs.failed} failed
        {jobs.authOrNotConfigured > 0
          ? ` · ${jobs.authOrNotConfigured} because of the key or provider setup`
          : ''}
      </span>
    </p>
  );
}

/** One provider's last result: "AI (text)" or "Voice". */
function TestRow({ label, test }: { label: string; test: LastTest }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      <span className="w-[68px] shrink-0 font-semibold text-ink">{label}</span>
      {test ? (
        <>
          <Pill tone={test.ok ? 'success' : 'danger'} dot>
            {test.ok ? 'Working' : 'Failed'}
          </Pill>
          <span className="break-words">{test.detail}</span>
          <span className="text-ink-3">· {new Date(test.at).toLocaleString()}</span>
        </>
      ) : (
        <span className="text-ink-3">Not tested yet.</span>
      )}
    </p>
  );
}

/** "Test connection": a tiny AI call and a voice session opened and closed, with the last results. */
export function AiTestCard({
  lastTest,
  lastVoiceTest,
  recentJobs,
}: {
  lastTest: LastTest;
  lastVoiceTest: LastTest;
  recentJobs: RecentJobs;
}) {
  const toast = useToast();
  const test = useApiMutation(() => testPlatformAi(), [platformKeys.ai]);
  const run = () =>
    test.mutate(undefined, {
      onSuccess: (r) => {
        const t = testRunToast(r);
        toast(t.tone, t.message);
      },
      onError: (err) => toast('error', errorMessage(err)),
    });
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">Test connection</h2>
        <p className="text-[12.5px] text-ink-3">Checks the AI key and the voice key in one go.</p>
        <TestRow label="AI (text)" test={lastTest} />
        <TestRow label="Voice" test={lastVoiceTest} />
        <RecentOutcomes jobs={recentJobs} />
      </div>
      <Button variant="secondary" onClick={run} isLoading={test.isPending}>
        Run test
      </Button>
    </Card>
  );
}
