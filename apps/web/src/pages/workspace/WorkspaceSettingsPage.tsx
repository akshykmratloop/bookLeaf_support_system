import type { WorkspaceSettingsStatus } from '@bookleaf/shared';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import {
  ChatSection,
  VoiceSection,
  WidgetSection,
} from '../../components/organisms/WorkspaceChannelSections';
import { AiSection, type Patch } from '../../components/organisms/WorkspaceSettingsSections';
import { errorMessage, isApiError } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { saveWorkspaceSettings, useWorkspaceSettings, workspaceKeys } from '../../lib/workspace';

function Sections({ status, reload }: { status: WorkspaceSettingsStatus; reload: () => void }) {
  const toast = useToast();
  const save = useApiMutation(saveWorkspaceSettings, [workspaceKeys.settings]);
  const update = (patch: Patch) =>
    save.mutate(
      { version: status.settings.version, ...patch },
      {
        onSuccess: () => toast('success', 'Workspace settings saved'),
        onError: (e) => {
          toast('error', errorMessage(e));
          reload();
        },
      },
    );
  const props = {
    status,
    isSaving: save.isPending,
    update,
    fieldError: (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined),
  };
  return (
    <div className="grid max-w-[960px] gap-4">
      <AiSection {...props} />
      <ChatSection {...props} />
      <VoiceSection {...props} />
      <WidgetSection {...props} />
    </div>
  );
}

export function WorkspaceSettingsPage() {
  const status = useWorkspaceSettings();
  return (
    <>
      <PageHeader
        title="Assistant settings"
        subtitle="Models, tone, chat and voice limits, widget origins and branding for this workspace. Each change saves immediately."
      />
      {status.isPending ? <LoadingState /> : null}
      {status.isError ? (
        <ErrorState message={errorMessage(status.error)} onRetry={() => void status.refetch()} />
      ) : null}
      {status.data ? (
        <Sections
          key={status.data.settings.version}
          status={status.data}
          reload={() => void status.refetch()}
        />
      ) : null}
    </>
  );
}
