import type { UpdateWorkspaceSettings, WorkspaceSettingsStatus } from '@bookleaf/shared';
import type { ReactNode } from 'react';
import { Card } from '../atoms/Card';
import { Input, Textarea } from '../atoms/Input';
import { Dropdown } from '../molecules/Dropdown';
import { Field } from '../molecules/Field';

export type Patch = Omit<UpdateWorkspaceSettings, 'version'>;

export interface SectionProps {
  status: WorkspaceSettingsStatus;
  isSaving: boolean;
  /** Saves one or more fields straight away (each control saves on change). */
  update: (patch: Patch) => void;
  fieldError: (path: string) => string | undefined;
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[12.5px] text-ink-2">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[12.5px] font-semibold">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

/** A number saved when the field loses focus, so typing does not fire a request per key. */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  disabled,
  error,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  error?: string;
  onCommit: (v: number) => void;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        disabled={disabled}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (n !== value) onCommit(n);
        }}
      />
    </Field>
  );
}

function ModelSelect({
  id,
  label,
  value,
  models,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  models: WorkspaceSettingsStatus['models'];
  disabled: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <Field id={id} label={label}>
      <Dropdown
        id={id}
        value={value ?? ''}
        disabled={disabled}
        options={[
          { value: '', label: 'Platform default' },
          ...models.map((m) => ({ value: m.id, label: m.label, hint: m.tier })),
        ]}
        onChange={(v) => onChange(v || null)}
      />
    </Field>
  );
}

export function AiSection({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  return (
    <Section
      title="AI models and tone"
      description={
        status.aiConfigured
          ? 'Which model handles each job, and how replies should sound.'
          : 'The platform has no AI key configured; tickets use the rule-based fallback.'
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <ModelSelect
          id="triageModel"
          label="Triage"
          value={s.triageModel}
          models={status.models}
          disabled={isSaving}
          onChange={(triageModel) => update({ triageModel })}
        />
        <ModelSelect
          id="draftModel"
          label="Reply drafts"
          value={s.draftModel}
          models={status.models}
          disabled={isSaving}
          onChange={(draftModel) => update({ draftModel })}
        />
        <ModelSelect
          id="chatModel"
          label="Chat"
          value={s.chatModel}
          models={status.models}
          disabled={isSaving}
          onChange={(chatModel) => update({ chatModel })}
        />
      </div>
      <Field
        id="toneGuide"
        label="Tone guide"
        hint="How the assistant should write to your customers. Saved when you leave the box."
        error={fieldError('toneGuide')}
      >
        <Textarea
          id="toneGuide"
          rows={4}
          defaultValue={s.toneGuide}
          disabled={isSaving}
          onBlur={(e) => {
            if (e.target.value !== s.toneGuide) update({ toneGuide: e.target.value });
          }}
        />
      </Field>
    </Section>
  );
}
