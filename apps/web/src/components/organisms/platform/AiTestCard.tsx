import type { PlatformAiStatus } from '@bookleaf/shared';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { Pill } from '../../atoms/Pill';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, testPlatformAi } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

/** "Test connection": one tiny call to the chosen provider and model, with the last result. */
export function AiTestCard({ lastTest }: { lastTest: PlatformAiStatus['lastTest'] }) {
  const toast = useToast();
  const test = useApiMutation(() => testPlatformAi(), [platformKeys.ai]);
  const run = () =>
    test.mutate(undefined, {
      onSuccess: (r) => toast(r.ok ? 'success' : 'error', r.detail),
      onError: (err) => toast('error', errorMessage(err)),
    });
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">Test connection</h2>
        {lastTest ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            <Pill tone={lastTest.ok ? 'success' : 'danger'} dot>
              {lastTest.ok ? 'Working' : 'Failed'}
            </Pill>
            <span className="break-words">{lastTest.detail}</span>
            <span className="text-ink-3">· {new Date(lastTest.at).toLocaleString()}</span>
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-2">Not tested yet since the server started.</p>
        )}
      </div>
      <Button variant="secondary" onClick={run} isLoading={test.isPending}>
        Run test
      </Button>
    </Card>
  );
}
