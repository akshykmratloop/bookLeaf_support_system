import { Input, Textarea } from '../atoms/Input';
import { Field } from '../molecules/Field';
import { VoiceNameField } from '../molecules/VoiceNameField';
import { NumberField, Section, Toggle, type SectionProps } from './WorkspaceSettingsSections';

export function ChatSection({ status, isSaving, update, fieldError }: SectionProps) {
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
        onChange={(chatEnabled) => update({ chatEnabled })}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField
          id="messagesPerMinute"
          label="Messages per minute"
          value={s.messagesPerMinute}
          min={1}
          max={120}
          disabled={isSaving}
          error={fieldError('messagesPerMinute')}
          onCommit={(messagesPerMinute) => update({ messagesPerMinute })}
        />
        <NumberField
          id="messagesPerDay"
          label="Messages per day"
          value={s.messagesPerDay}
          min={1}
          max={2000}
          disabled={isSaving}
          error={fieldError('messagesPerDay')}
          onCommit={(messagesPerDay) => update({ messagesPerDay })}
        />
        <NumberField
          id="maxTurnsPerSession"
          label="Turns per conversation"
          value={s.maxTurnsPerSession}
          min={1}
          max={200}
          disabled={isSaving}
          error={fieldError('maxTurnsPerSession')}
          onCommit={(maxTurnsPerSession) => update({ maxTurnsPerSession })}
        />
      </div>
    </Section>
  );
}

export function VoiceSection({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  return (
    <Section
      title="Voice"
      description={
        status.voiceConfigured
          ? 'Customers talk to the assistant in the browser. Calls end at the time limit.'
          : 'The platform has no voice provider key configured; calls are unavailable until it does.'
      }
    >
      <Toggle
        id="voiceEnabled"
        label={s.voiceEnabled ? 'On for customers' : 'Off'}
        checked={s.voiceEnabled}
        disabled={isSaving}
        onChange={(voiceEnabled) => update({ voiceEnabled })}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <VoiceNameField
          value={s.voiceName}
          voices={status.voices}
          disabled={isSaving}
          error={fieldError('voiceName')}
          onCommit={(voiceName) => {
            if (voiceName !== s.voiceName) update({ voiceName });
          }}
        />
        <NumberField
          id="maxCallSeconds"
          label="Seconds per call"
          value={s.maxCallSeconds}
          min={30}
          max={300}
          disabled={isSaving}
          error={fieldError('maxCallSeconds')}
          onCommit={(maxCallSeconds) => update({ maxCallSeconds })}
        />
        <NumberField
          id="callsPerHour"
          label="Calls per hour"
          value={s.callsPerHour}
          min={1}
          max={60}
          disabled={isSaving}
          error={fieldError('callsPerHour')}
          onCommit={(callsPerHour) => update({ callsPerHour })}
        />
        <NumberField
          id="callsPerDay"
          label="Calls per day"
          value={s.callsPerDay}
          min={1}
          max={200}
          disabled={isSaving}
          error={fieldError('callsPerDay')}
          onCommit={(callsPerDay) => update({ callsPerDay })}
        />
      </div>
    </Section>
  );
}

export function WidgetSection({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  const originsError = fieldError('allowedOrigins');
  const commit = (key: 'brandName' | 'customerNoun' | 'itemNoun') => (value: string) => {
    if (value !== s[key]) update({ [key]: value });
  };
  return (
    <Section
      title="Widget and branding"
      description="Where the support widget may be embedded, and the words your customers see."
    >
      <Field
        id="allowedOrigins"
        label="Pages allowed to embed the widget"
        hint="One origin per line, e.g. https://app.example.com"
        error={originsError}
      >
        <Textarea
          id="allowedOrigins"
          name="allowedOrigins"
          rows={3}
          aria-invalid={originsError ? true : undefined}
          aria-describedby={originsError ? 'allowedOrigins-error' : 'allowedOrigins-hint'}
          defaultValue={s.allowedOrigins.join('\n')}
          disabled={isSaving}
          onBlur={(e) => {
            const allowedOrigins = e.target.value
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean);
            if (allowedOrigins.join() !== s.allowedOrigins.join()) update({ allowedOrigins });
          }}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-4">
        <Field id="brandName" label="Brand name" error={fieldError('brandName')}>
          <Input
            id="brandName"
            defaultValue={s.brandName}
            disabled={isSaving}
            onBlur={(e) => commit('brandName')(e.target.value)}
          />
        </Field>
        <Field id="brandColor" label="Brand colour" error={fieldError('brandColor')}>
          <Input
            id="brandColor"
            type="color"
            defaultValue={s.brandColor}
            disabled={isSaving}
            onBlur={(e) => {
              if (e.target.value !== s.brandColor) update({ brandColor: e.target.value });
            }}
          />
        </Field>
        <Field
          id="customerNoun"
          label="What you call a customer"
          hint="e.g. author, borrower, member"
          error={fieldError('customerNoun')}
        >
          <Input
            id="customerNoun"
            defaultValue={s.customerNoun}
            disabled={isSaving}
            onBlur={(e) => commit('customerNoun')(e.target.value)}
          />
        </Field>
        <Field
          id="itemNoun"
          label="What you call an item"
          hint="e.g. book, loan, order"
          error={fieldError('itemNoun')}
        >
          <Input
            id="itemNoun"
            defaultValue={s.itemNoun}
            disabled={isSaving}
            onBlur={(e) => commit('itemNoun')(e.target.value)}
          />
        </Field>
      </div>
    </Section>
  );
}
