import type { AssistantAdminStatus, ChannelState } from '@bookleaf/shared';
import { MessagesSquare, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../../components/atoms/Card';
import { Pill, type Tone } from '../../components/atoms/Pill';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { errorMessage } from '../../lib/api';
import {
  assistantKeys,
  CHANNEL_LABEL,
  saveAssistantSettings,
  useAssistantAdmin,
} from '../../lib/assistant';
import { lockReason } from '../../lib/planLock';
import { useApiMutation } from '../../lib/queries';

const TONE: Record<ChannelState, Tone> = {
  AVAILABLE: 'success',
  DISABLED: 'neutral',
  NOT_CONFIGURED: 'warning',
  AI_OUTAGE: 'warning',
};

interface ChannelProps {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  state: ChannelState;
  limits: string;
  isSaving: boolean;
  /** Why the switch cannot be turned on (plan or AI off), or undefined. */
  locked?: string;
  onToggle: (next: boolean) => void;
}

function ChannelCard(p: ChannelProps) {
  const id = `toggle-${p.title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-soft text-brand-ink">
            {p.icon}
          </span>
          <div>
            <p className="text-[15px] font-semibold">{p.title}</p>
            <p className="text-[12.5px] text-ink-2">{p.description}</p>
          </div>
        </div>
        <label htmlFor={id} className="flex items-center gap-2 text-[12.5px] font-semibold">
          <input
            id={id}
            type="checkbox"
            role="switch"
            aria-checked={p.enabled}
            aria-describedby={p.locked ? `${id}-locked` : undefined}
            checked={p.enabled}
            disabled={p.isSaving || Boolean(p.locked)}
            onChange={(e) => p.onToggle(e.target.checked)}
            className="h-4 w-4"
          />
          {p.enabled ? 'On for authors' : 'Off'}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <Pill tone={TONE[p.state]} dot>
          {CHANNEL_LABEL[p.state]}
        </Pill>
        <span>{p.limits}</span>
      </div>
      {p.locked ? (
        <p id={`${id}-locked`} className="text-[12px] text-ink-3">
          {p.locked}
        </p>
      ) : null}
    </Card>
  );
}

function Settings({ status, reload }: { status: AssistantAdminStatus; reload: () => void }) {
  const toast = useToast();
  const { settings, availability } = status;
  const save = useApiMutation(
    (patch: Parameters<typeof saveAssistantSettings>[0]) => saveAssistantSettings(patch),
    [assistantKeys.admin, assistantKeys.availability],
  );
  const update = (patch: Omit<Parameters<typeof saveAssistantSettings>[0], 'version'>) =>
    save.mutate(
      { version: settings.version, ...patch },
      {
        onSuccess: () => toast('success', 'Assistant settings saved'),
        onError: (e) => {
          toast('error', errorMessage(e));
          // The save failed, so the shown values may be out of date: reload them.
          reload();
        },
      },
    );
  const { chat, voice } = availability;
  return (
    <div className="grid max-w-[880px] gap-4">
      <ChannelCard
        icon={<MessagesSquare size={17} aria-hidden />}
        title="Ask BookLeaf chat"
        description="Authors ask about their own books, royalties and payouts. Answers are fact-checked against their records."
        enabled={settings.chatEnabled}
        state={chat.state}
        limits={`${chat.maxMessageChars} characters per message · ${chat.messagesPerMinute}/min · ${chat.messagesPerDay}/day · ${chat.maxTurnsPerSession} per conversation`}
        isSaving={save.isPending}
        locked={lockReason(status.plan.chatAllowed, status.plan.aiEnabled, settings.chatEnabled)}
        onToggle={(chatEnabled) => update({ chatEnabled })}
      />
      <ChannelCard
        icon={<Phone size={17} aria-hidden />}
        title="Voice support call"
        description="Authors talk to BookLeaf support in the browser. Calls end automatically at the time limit."
        enabled={settings.voiceEnabled}
        state={voice.state}
        limits={`${Math.round(voice.maxCallSeconds / 60)} min per call · ${voice.callsPerHour}/hour · ${voice.callsPerDay}/day · one call at a time`}
        isSaving={save.isPending}
        locked={lockReason(status.plan.voiceAllowed, status.plan.aiEnabled, settings.voiceEnabled)}
        onToggle={(voiceEnabled) => update({ voiceEnabled })}
      />
    </div>
  );
}

export function AssistantSettingsPage() {
  const status = useAssistantAdmin();
  return (
    <>
      <PageHeader
        title="Author Assistant"
        subtitle="Switch chat and voice on or off for all authors. Changes apply immediately."
      />
      {status.isPending ? <LoadingState /> : null}
      {status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : null}
      {status.data ? <Settings status={status.data} reload={() => void status.refetch()} /> : null}
    </>
  );
}
