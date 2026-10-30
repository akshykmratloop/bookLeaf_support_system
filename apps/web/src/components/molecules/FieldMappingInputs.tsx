import type { DataSource } from '@bookleaf/shared';
import type { RefDraft } from '../../lib/dataSources';
import { Input } from '../atoms/Input';
import { Field } from './Field';
import { SourcePathPicker } from './SourcePathPicker';

interface Props {
  /** The field key; `{id}` in it makes a per-item field, read inside each item of the list. */
  fieldKey: string;
  sources: DataSource[];
  value: RefDraft;
  onChange: (value: RefDraft) => void;
  fieldError: (path: string) => string | undefined;
}

/** Where a customer-data field is read from in the data sources (U-9). */
export function FieldMappingInputs({ fieldKey, sources, value, onChange, fieldError }: Props) {
  if (fieldKey.includes('{id}'))
    return (
      <Field
        id="field-path"
        label="Path inside each item (optional)"
        hint="Read from every element of the item list mapped above, e.g. royalty.pending"
        error={fieldError('path')}
      >
        <Input
          id="field-path"
          className="font-mono"
          value={value.path}
          maxLength={200}
          onChange={(e) => onChange({ sourceId: '', path: e.target.value })}
        />
      </Field>
    );
  if (sources.length === 0)
    return (
      <p className="text-[12.5px] text-ink-3">
        Save your data sources on the Product connection page to read this field from any JSON.
      </p>
    );
  return (
    <SourcePathPicker
      id="field-map"
      label="Read from data source (optional)"
      sources={sources}
      value={value}
      onChange={onChange}
      sourceError={fieldError('sourceId')}
      pathError={fieldError('path')}
    />
  );
}
