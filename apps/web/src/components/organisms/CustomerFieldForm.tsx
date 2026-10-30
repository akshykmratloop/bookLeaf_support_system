import {
  CUSTOMER_FIELD_TYPES,
  type CustomerField,
  type CustomerFieldInput,
  type DataSource,
} from '@bookleaf/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../atoms/Button';
import { Input, Select, Textarea } from '../atoms/Input';
import { Field } from '../molecules/Field';
import { FieldMappingInputs } from '../molecules/FieldMappingInputs';

interface Draft {
  key: string;
  label: string;
  type: CustomerFieldInput['type'];
  description: string;
  allowedValues: string;
  visibleToCustomer: boolean;
  position: string;
  /** U-9: the data source and path this value is read from ('' = not mapped). */
  sourceId: string;
  path: string;
}

const EMPTY: Draft = {
  key: '',
  label: '',
  type: 'TEXT',
  description: '',
  allowedValues: '',
  visibleToCustomer: true,
  position: '0',
  sourceId: '',
  path: '',
};

const draftOf = (f: CustomerField): Draft => ({
  key: f.key,
  label: f.label,
  type: f.type,
  description: f.description,
  allowedValues: f.allowedValues.join(', '),
  visibleToCustomer: f.visibleToCustomer,
  position: String(f.position),
  sourceId: f.sourceId ?? '',
  path: f.path ?? '',
});

const toInput = (d: Draft): CustomerFieldInput => ({
  key: d.key,
  label: d.label,
  type: d.type,
  description: d.description,
  allowedValues: d.allowedValues
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean),
  visibleToCustomer: d.visibleToCustomer,
  position: Number(d.position) || 0,
  // Per-item fields are read inside each item of the list, never from a source of their own.
  sourceId: d.key.includes('{id}') ? null : d.sourceId || null,
  path: d.path.trim() || null,
});

interface Props {
  initial: CustomerField | null;
  /** The saved data sources a field can be read from. */
  sources: DataSource[];
  isSaving: boolean;
  fieldError: (path: string) => string | undefined;
  onSubmit: (input: CustomerFieldInput) => void;
  onCancel: () => void;
}

/** Add or edit one customer-data field: what the product sends and what it means. */
export function CustomerFieldForm({
  initial,
  sources,
  isSaving,
  fieldError,
  onSubmit,
  onCancel,
}: Props) {
  const [d, setD] = useState<Draft>(() => (initial ? draftOf(initial) : EMPTY));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(toInput(d));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="field-key"
          label="Key"
          hint="Dotted, lowercase. Use {id} for a per-item fact, e.g. item.{id}.status"
          error={fieldError('key')}
        >
          <Input id="field-key" value={d.key} onChange={(e) => set({ key: e.target.value })} />
        </Field>
        <Field id="field-label" label="Label" error={fieldError('label')}>
          <Input
            id="field-label"
            value={d.label}
            onChange={(e) => set({ label: e.target.value })}
          />
        </Field>
        <Field id="field-type" label="Type" error={fieldError('type')}>
          <Select
            id="field-type"
            value={d.type}
            onChange={(e) => set({ type: e.target.value as Draft['type'] })}
          >
            {CUSTOMER_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="field-position" label="Order" error={fieldError('position')}>
          <Input
            id="field-position"
            type="number"
            min={0}
            value={d.position}
            onChange={(e) => set({ position: e.target.value })}
          />
        </Field>
      </div>
      <Field
        id="field-description"
        label="What it means (shown to the assistant)"
        error={fieldError('description')}
      >
        <Textarea
          id="field-description"
          rows={2}
          value={d.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      {d.type === 'STATUS' ? (
        <Field
          id="field-values"
          label="Allowed status codes"
          hint="Comma-separated, UPPER_SNAKE_CASE, e.g. ACTIVE, OVERDUE, CLOSED"
          error={fieldError('allowedValues')}
        >
          <Input
            id="field-values"
            value={d.allowedValues}
            onChange={(e) => set({ allowedValues: e.target.value })}
          />
        </Field>
      ) : null}
      <FieldMappingInputs
        fieldKey={d.key}
        sources={sources}
        value={{ sourceId: d.sourceId, path: d.path }}
        onChange={(v) => set(v)}
        fieldError={fieldError}
      />
      <label className="flex items-center gap-2 text-[12.5px] font-semibold">
        <input
          id="field-visible"
          name="visibleToCustomer"
          type="checkbox"
          className="h-4 w-4"
          checked={d.visibleToCustomer}
          onChange={(e) => set({ visibleToCustomer: e.target.checked })}
        />
        Customers may see this value
      </label>
      <div className="flex gap-2">
        <Button type="submit" isLoading={isSaving}>
          {initial ? 'Save field' : 'Add field'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
