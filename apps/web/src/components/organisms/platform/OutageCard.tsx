import type { PlatformAiSettings } from '@bookleaf/shared';
import { Card } from '../../atoms/Card';
import { SwitchRow } from '../../molecules/SwitchRow';
import { useToast } from '../../molecules/Toast';
import { errorMessage } from '../../../lib/api';
import { platformKeys, savePlatformAi } from '../../../lib/platform';
import { useApiMutation } from '../../../lib/queries';

/** The global switch: AI off for every customer at once (fallbacks keep tickets flowing). */
export function OutageCard({ settings }: { settings: PlatformAiSettings }) {
  const toast = useToast();
  const save = useApiMutation(savePlatformAi, [platformKeys.ai]);
  const flip = (simulateOutage: boolean) =>
    save.mutate(
      { version: settings.version, simulateOutage },
      {
        onSuccess: () =>
          toast('success', simulateOutage ? 'AI switched off for everyone' : 'AI back on'),
        onError: (err) => toast('error', errorMessage(err)),
      },
    );
  return (
    <Card className={`p-5 ${settings.simulateOutage ? 'border-danger' : ''}`}>
      <SwitchRow
        id="pf-outage"
        label="AI outage switch"
        description={
          settings.simulateOutage
            ? 'On: every customer is on rule-based triage and template drafts; chat and calls are unavailable.'
            : 'Turn on to stop all AI for every customer at once. Tickets keep flowing on the fallbacks.'
        }
        checked={settings.simulateOutage}
        disabled={save.isPending}
        onChange={flip}
      />
    </Card>
  );
}
