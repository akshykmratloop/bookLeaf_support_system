import { lockReason } from '../../lib/planLock';
import { VoiceNameField } from '../molecules/VoiceNameField';
import { LimitField, Section, Toggle, type SectionProps } from './WorkspaceSettingsSections';

export function ChatSection(props: SectionProps) {
  const { status, isSaving, update } = props;
  const s = status.settings;
  return (
    <Section
      title="Chat"
      description="Customers ask about their own records. Answers are fact-checked against the fields you defined."
    >
      <Toggle
        id="chatEnabled"
        label={s.chatEnabled ? 'On for customers' : 'Off'}
        checked={s.chatEnabled}
        disabled={isSaving}
        reason={lockReason(status.plan.chatAllowed, status.plan.aiEnabled, s.chatEnabled)}
        onChange={(chatEnabled) => update({ chatEnabled })}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <LimitField {...props} name="messagesPerMinute" label="Messages per minute" />
        <LimitField {...props} name="messagesPerDay" label="Messages per day" />
        <LimitField {...props} name="maxTurnsPerSession" label="Turns per conversation" />
      </div>
    </Section>
  );
}

export function VoiceSection(props: SectionProps) {
  const { status, isSaving, update, fieldError } = props;
  const s = status.settings;
  return (
    <Section
      title="Voice"
      description={
        status.voiceConfigured
          ? 'Customers talk to the assistant in the browser. Calls end at the time limit.'
          : 'Your support provider has no voice service set up yet; calls are unavailable until it does.'
      }
    >
      <Toggle
        id="voiceEnabled"
        label={s.voiceEnabled ? 'On for customers' : 'Off'}
        checked={s.voiceEnabled}
        disabled={isSaving}
        reason={lockReason(status.plan.voiceAllowed, status.plan.aiEnabled, s.voiceEnabled)}
        onChange={(voiceEnabled) => update({ voiceEnabled })}
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <VoiceNameField
          value={s.voiceName}
          voices={status.voices}
          samples={status.voiceSamples}
          disabled={isSaving}
          error={fieldError('voiceName')}
          onCommit={(voiceName) => {
            if (voiceName !== s.voiceName) update({ voiceName });
          }}
        />
        <LimitField {...props} name="maxCallSeconds" label="Seconds per call" />
        <LimitField {...props} name="callsPerHour" label="Calls per hour" />
        <LimitField {...props} name="callsPerDay" label="Calls per day" />
      </div>
    </Section>
  );
}
