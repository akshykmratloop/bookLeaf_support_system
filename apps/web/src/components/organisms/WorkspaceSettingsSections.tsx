import {
  LIMIT_BOUNDS,
  type LimitKey,
  type UpdateWorkspaceSettings,
  type WorkspaceSettingsStatus,
} from '@bookleaf/shared';
import type { ReactNode } from 'react';
import { Card } from '../atoms/Card';
import { Input } from '../atoms/Input';
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
  reason,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  /** Why the switch is locked (e.g. the plan does not include this), shown under it. */
  reason?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2 text-[12.5px] font-semibold">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-describedby={reason ? `${id}-reason` : undefined}
          checked={checked}
          disabled={disabled || Boolean(reason)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
        {label}
      </label>
      {reason ? (
        <p id={`${id}-reason`} className="text-[12px] text-ink-3">
          {reason}
        </p>
      ) : null}
    </div>
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
    <Field id={id} label={label} hint={`Up to ${max}`} error={error}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (n !== value) onCommit(n);
        }}
      />
    </Field>
  );
}

/** A customer limit field: the schema's floor up to the plan's maximum (the server enforces it). */
export function LimitField({
  name,
  label,
  status,
  isSaving,
  update,
  fieldError,
}: SectionProps & { name: LimitKey; label: string }) {
  return (
    <NumberField
      id={name}
      label={label}
      value={status.settings[name]}
      min={LIMIT_BOUNDS[name].min}
      max={status.plan.max[name]}
      disabled={isSaving}
      error={fieldError(name)}
      onCommit={(v) => update({ [name]: v })}
    />
  );
}
