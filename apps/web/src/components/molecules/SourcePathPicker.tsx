import type { DataSource } from '@bookleaf/shared';
import type { RefDraft } from '../../lib/dataSources';
import { Input } from '../atoms/Input';
import { Dropdown } from './Dropdown';
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
        <Dropdown
          id={`${id}-source`}
          value={value.sourceId}
          options={[
            { value: '', label: 'Not mapped' },
            ...sources.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={(sourceId) => onChange({ ...value, sourceId })}
        />
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
