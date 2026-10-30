import type { DataSource } from '@bookleaf/shared';
import type { RefDraft } from '../../lib/dataSources';
import { Input, Select } from '../atoms/Input';
import { Field } from './Field';

interface Props {
  id: string;
  label: string;
  sources: DataSource[];
  value: RefDraft;
  onChange: (value: RefDraft) => void;
  pathLabel?: string;
  pathHint?: string;
  sourceError?: string;
  pathError?: string;
}

/** Which data source holds a value, and where in its JSON answer (e.g. data.user.name). */
export function SourcePathPicker({
  id,
  label,
  sources,
  value,
  onChange,
  pathLabel = 'Path in the answer',
  pathHint = 'Dotted, e.g. data.user.name; $ = the whole answer',
  sourceError,
  pathError,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
      <Field id={`${id}-source`} label={label} error={sourceError}>
        <Select
          id={`${id}-source`}
          value={value.sourceId}
          onChange={(e) => onChange({ ...value, sourceId: e.target.value })}
        >
          <option value="">Not mapped</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${id}-path`} label={pathLabel} hint={pathHint} error={pathError}>
        <Input
          id={`${id}-path`}
          value={value.path}
          maxLength={200}
          className="font-mono"
          onChange={(e) => onChange({ ...value, path: e.target.value })}
        />
      </Field>
    </div>
  );
}
