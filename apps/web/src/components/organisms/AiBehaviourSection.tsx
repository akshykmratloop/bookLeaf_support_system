import {
  MAX_TOPICS,
  REPLY_FORMALITIES,
  REPLY_FORMALITY_LABEL,
  REPLY_LANGUAGES,
  REPLY_LANGUAGE_LABEL,
  REPLY_LENGTHS,
  REPLY_LENGTH_LABEL,
} from '@bookleaf/shared';
import { Input, Textarea } from '../atoms/Input';
import { Dropdown } from '../molecules/Dropdown';
import { Field } from '../molecules/Field';
import { Section, type Patch, type SectionProps } from './WorkspaceSettingsSections';

type ChoiceKey = 'replyLanguage' | 'replyLength' | 'formality';
const CHOICES: {
  key: ChoiceKey;
  label: string;
  options: readonly string[];
  labels: Record<string, string>;
}[] = [
  {
    key: 'replyLanguage',
    label: 'Language',
    options: REPLY_LANGUAGES,
    labels: REPLY_LANGUAGE_LABEL,
  },
  { key: 'replyLength', label: 'Reply length', options: REPLY_LENGTHS, labels: REPLY_LENGTH_LABEL },
  {
    key: 'formality',
    label: 'Formality',
    options: REPLY_FORMALITIES,
    labels: REPLY_FORMALITY_LABEL,
  },
];

type TextKey = 'greeting' | 'signature';
const TEXTS: { key: TextKey; label: string; hint: string }[] = [
  {
    key: 'greeting',
    label: 'Greeting',
    hint: 'Opens drafts, the first chat reply and calls. {name} becomes the customer’s first name.',
  },
  { key: 'signature', label: 'Signature', hint: 'Closes every reply draft, e.g. “Team BookLeaf”.' },
];

/** Topics, one per line, trimmed and de-duplicated. */
const topicsFrom = (text: string) => [
  ...new Set(
    text
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
];

/** How the AI writes and speaks for this workspace: used by triage, drafts, chat and voice. */
export function AiBehaviourSection({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  const commitText = (key: 'toneGuide' | TextKey, value: string) => {
    if (value !== s[key]) update({ [key]: value });
  };
  return (
    <Section
      title="How the AI writes"
      description="Tone, greeting, language and topics to avoid. Safety checks stay on whatever you choose. Each field saves when you leave it."
    >
      <Field
        id="toneGuide"
        label="Tone and brand voice"
        hint="How replies should sound, in your words."
        error={fieldError('toneGuide')}
      >
        <Textarea
          id="toneGuide"
          rows={3}
          defaultValue={s.toneGuide}
          disabled={isSaving}
          aria-describedby="toneGuide-hint"
          onBlur={(e) => commitText('toneGuide', e.target.value)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {TEXTS.map((t) => (
          <Field key={t.key} id={t.key} label={t.label} hint={t.hint} error={fieldError(t.key)}>
            <Input
              id={t.key}
              defaultValue={s[t.key]}
              disabled={isSaving}
              aria-describedby={`${t.key}-hint`}
              onBlur={(e) => commitText(t.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {CHOICES.map((c) => (
          <Field key={c.key} id={c.key} label={c.label}>
            <Dropdown
              id={c.key}
              value={s[c.key] ?? ''}
              disabled={isSaving}
              options={[
                { value: '', label: 'Not set' },
                ...c.options.map((o) => ({ value: o, label: c.labels[o] ?? o })),
              ]}
              onChange={(v) => update({ [c.key]: v === '' ? null : v } as Patch)}
            />
          </Field>
        ))}
      </div>
      <Field
        id="topicsToAvoid"
        label="Topics to avoid"
        hint={`One per line, up to ${MAX_TOPICS}. The AI politely declines these.`}
        error={fieldError('topicsToAvoid')}
      >
        <Textarea
          id="topicsToAvoid"
          rows={3}
          defaultValue={s.topicsToAvoid.join('\n')}
          disabled={isSaving}
          aria-describedby="topicsToAvoid-hint"
          onBlur={(e) => {
            const topicsToAvoid = topicsFrom(e.target.value);
            if (topicsToAvoid.join('\n') !== s.topicsToAvoid.join('\n')) update({ topicsToAvoid });
          }}
        />
      </Field>
    </Section>
  );
}
