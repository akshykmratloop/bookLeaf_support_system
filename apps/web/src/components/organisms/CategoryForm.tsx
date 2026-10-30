import {
  CATEGORY_LIMITS,
  PRIORITIES,
  PRIORITY_LABELS,
  SLA_HOURS_LIMITS,
  type Category,
  type CreateCategory,
  type Priority,
} from '@bookleaf/shared';
import { useState, type FormEvent } from 'react';
import { keyFromLabel } from '../../lib/categories';
import { Button } from '../atoms/Button';
import { Input, Textarea } from '../atoms/Input';
import { CheckboxField } from '../molecules/CheckboxField';
import { Dropdown } from '../molecules/Dropdown';
import { Field } from '../molecules/Field';

interface Draft {
  key: string;
  keyEdited: boolean;
  label: string;
  description: string;
  defaultPriority: Priority;
  slaHours: string;
  isActive: boolean;
}

const EMPTY: Draft = {
  key: '',
  keyEdited: false,
  label: '',
  description: '',
  defaultPriority: 'MEDIUM',
  slaHours: '',
  isActive: true,
};

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

const draftOf = (c: Category): Draft => ({
  ...c,
  keyEdited: true,
  slaHours: c.slaHours === null ? '' : String(c.slaHours),
});

const toInput = (d: Draft): CreateCategory => ({
  key: d.key,
  label: d.label,
  description: d.description,
  defaultPriority: d.defaultPriority,
  slaHours: d.slaHours.trim() ? Number(d.slaHours) : null,
  isActive: d.isActive,
});

interface Props {
  initial: Category | null;
  isSaving: boolean;
  fieldError: (path: string) => string | undefined;
  onSubmit: (input: CreateCategory) => void;
  onCancel: () => void;
}

/** Add or edit one ticket category. The key is set once, when the category is created. */
export function CategoryForm({ initial, isSaving, fieldError, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<Draft>(() => (initial ? draftOf(initial) : EMPTY));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const setLabel = (label: string) =>
    set(d.keyEdited ? { label } : { label, key: keyFromLabel(label) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(toInput(d));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="category-label" label="Name" error={fieldError('label')}>
          <Input
            id="category-label"
            name="label"
            maxLength={CATEGORY_LIMITS.label}
            value={d.label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field
          id="category-key"
          label="Key"
          hint={initial ? 'Fixed once created' : 'UPPER_SNAKE_CASE; fixed once created'}
          error={fieldError('key')}
        >
          <Input
            id="category-key"
            name="key"
            className="font-mono"
            value={d.key}
            readOnly={initial !== null}
            onChange={(e) => set({ key: e.target.value.toUpperCase(), keyEdited: true })}
          />
        </Field>
        <Field id="category-priority" label="Usual priority" error={fieldError('defaultPriority')}>
          <Dropdown
            id="category-priority"
            name="defaultPriority"
            value={d.defaultPriority}
            options={PRIORITY_OPTIONS}
            onChange={(defaultPriority) => set({ defaultPriority })}
          />
        </Field>
        <Field
          id="category-sla"
          label="First reply within (hours)"
          hint={`Optional, ${SLA_HOURS_LIMITS.min}–${SLA_HOURS_LIMITS.max}. Empty: the priority's target.`}
          error={fieldError('slaHours')}
        >
          <Input
            id="category-sla"
            name="slaHours"
            type="number"
            min={SLA_HOURS_LIMITS.min}
            max={SLA_HOURS_LIMITS.max}
            value={d.slaHours}
            onChange={(e) => set({ slaHours: e.target.value })}
          />
        </Field>
      </div>
      <Field
        id="category-description"
        label="What belongs here (the AI reads this to sort tickets)"
        error={fieldError('description')}
      >
        <Textarea
          id="category-description"
          name="description"
          rows={3}
          maxLength={CATEGORY_LIMITS.description}
          value={d.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <CheckboxField
        id="category-active"
        name="isActive"
        checked={d.isActive}
        label="Active (new tickets can be sorted into it)"
        onChange={(isActive) => set({ isActive })}
      />
      <div className="flex gap-2">
        <Button type="submit" isLoading={isSaving}>
          {initial ? 'Save category' : 'Add category'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
